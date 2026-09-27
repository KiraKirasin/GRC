import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from '../auth/middleware.js';
import { EMAIL_PROCESSES, defaultTemplateRows, processLabel } from './templates.js';

export function registerEmailTemplateRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/email-templates', requirePermission('email-templates:read'), async (_req, res) => {
    try {
      const rows = await prisma.emailTemplate.findMany({ orderBy: [{ process: 'asc' }, { locale: 'asc' }] });
      if (!rows.length) {
        const defaults = defaultTemplateRows();
        await prisma.emailTemplate.createMany({ data: defaults });
        return res.json(defaults);
      }
      res.json(rows.map(row => ({ ...row, processLabel: EMAIL_PROCESSES.includes(row.process as typeof EMAIL_PROCESSES[number]) ? processLabel(row.process as typeof EMAIL_PROCESSES[number]) : row.process })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load email templates' });
    }
  });

  app.post('/api/email-templates/seed', requirePermission('email-templates:write'), async (_req, res) => {
    try {
      const existing = await prisma.emailTemplate.findMany({ select: { process: true, locale: true } });
      const keys = new Set(existing.map(row => `${row.process}:${row.locale}`));
      const missing = defaultTemplateRows().filter(row => !keys.has(`${row.process}:${row.locale}`));
      if (missing.length) await prisma.emailTemplate.createMany({ data: missing });
      res.json({ created: missing.length });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to seed email templates' });
    }
  });

  app.post('/api/email-templates', requirePermission('email-templates:write'), async (req, res) => {
    try {
      const body = req.body || {};
      const process = String(body.process || '').trim();
      const locale = String(body.locale || 'uk').trim().toLowerCase();
      const name = String(body.name || '').trim();
      if (!process) return res.status(400).json({ error: 'Process is required' });
      if (!['uk', 'en', 'ru'].includes(locale)) {
        return res.status(400).json({ error: 'Locale must be uk, en, or ru' });
      }
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const created = await prisma.emailTemplate.create({
        data: {
          process,
          locale,
          name,
          subject: String(body.subject || '').trim() || name,
          bodyText: String(body.bodyText || ''),
          bodyHtml: String(body.bodyHtml || ''),
          enabled: body.enabled === undefined ? true : Boolean(body.enabled),
        },
      });
      res.status(201).json({
        ...created,
        processLabel: EMAIL_PROCESSES.includes(created.process as typeof EMAIL_PROCESSES[number])
          ? processLabel(created.process as typeof EMAIL_PROCESSES[number])
          : created.process,
      });
    } catch (error: unknown) {
      console.error(error);
      const code = String((error as { code?: string })?.code || '');
      if (code === 'P2002') {
        return res.status(409).json({ error: 'A template for this process and language already exists' });
      }
      res.status(500).json({ error: 'Failed to create email template' });
    }
  });

  app.patch('/api/email-templates/:id', requirePermission('email-templates:write'), async (req, res) => {
    try {
      const body = req.body || {};
      const updated = await prisma.emailTemplate.update({
        where: { id: req.params.id },
        data: {
          name: String(body.name ?? ''),
          subject: String(body.subject ?? ''),
          bodyText: String(body.bodyText ?? ''),
          bodyHtml: String(body.bodyHtml ?? ''),
          enabled: Boolean(body.enabled),
        },
      });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update email template' });
    }
  });
}
