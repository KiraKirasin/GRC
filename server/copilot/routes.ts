import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { auditFromRequest } from '../audit.js';
import {
  copilotProviderStatus,
  runCopilotAgent,
  type CopilotChatMessage,
} from './agent.js';

export function registerCopilotRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/copilot/status', (_req, res) => {
    res.json(copilotProviderStatus());
  });

  /**
   * CISO Copilot chat — powered by Azure OpenAI (Microsoft Copilot stack)
   * when configured; otherwise returns grounded local fallback from GRC DB.
   */
  app.post('/api/copilot/chat', async (req, res) => {
    try {
      const message = String(req.body?.message || '').trim();
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }
      if (message.length > 4000) {
        return res.status(400).json({ error: 'message is too long' });
      }

      const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
      const history: CopilotChatMessage[] = rawHistory
        .slice(-12)
        .filter(
          (m: unknown): m is CopilotChatMessage =>
            Boolean(m) &&
            typeof m === 'object' &&
            (m as CopilotChatMessage).role &&
            typeof (m as CopilotChatMessage).content === 'string' &&
            ((m as CopilotChatMessage).role === 'user' ||
              (m as CopilotChatMessage).role === 'assistant'),
        )
        .map((m: CopilotChatMessage) => ({
          role: m.role,
          content: String(m.content).slice(0, 4000),
        }));

      const { reply, provider } = await runCopilotAgent(prisma, history, message);

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'create',
        entityType: 'user',
        entityLabel: 'copilot',
        summary: `CISO Copilot reply via ${provider}`,
        metadata: {
          provider,
          messagePreview: message.slice(0, 120),
        },
      }).catch(() => undefined);

      res.json({
        reply,
        provider,
        microsoftCopilot: provider === 'azure_openai',
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Copilot agent failed',
      });
    }
  });
}
