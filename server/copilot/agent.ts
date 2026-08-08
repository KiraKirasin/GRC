import type { PrismaClient } from '@prisma/client';

export type CopilotChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Build a compact GRC snapshot the model can ground answers on. */
export async function buildGrcContext(prisma: PrismaClient): Promise<string> {
  const [projects, projectControls, policies, controls] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, title: true, company: true, status: true, framework: true, progress: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.projectControl.findMany({
      select: {
        projectId: true,
        controlCode: true,
        title: true,
        framework: true,
        category: true,
        status: true,
        owner: true,
        evidence: true,
        attachments: true,
      },
      take: 200,
    }),
    prisma.policy.findMany({
      select: { title: true, version: true, framework: true, status: true, owner: true },
      take: 50,
    }),
    prisma.gRCControl.findMany({
      select: { controlCode: true, title: true, framework: true, category: true, status: true },
      take: 80,
      orderBy: { title: 'asc' },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  let withEvidence = 0;
  for (const c of projectControls) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    const evidence = parseJsonArray(c.evidence);
    const attachments = parseJsonArray(c.attachments);
    if (evidence.length > 0 || attachments.length > 0) withEvidence += 1;
  }

  const gaps = projectControls
    .filter((c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'not_applicable')
    .slice(0, 25)
    .map((c) => ({
      code: c.controlCode || null,
      title: c.title,
      framework: c.framework,
      status: c.status,
      owner: c.owner || null,
    }));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    projects: projects.map((p) => ({
      name: p.title,
      company: p.company,
      status: p.status,
      framework: p.framework,
      progress: p.progress,
    })),
    projectControlSummary: {
      total: projectControls.length,
      byStatus: statusCounts,
      withEvidence,
      withoutEvidence: projectControls.length - withEvidence,
    },
    topGaps: gaps,
    policies: policies.map((p) => ({
      title: p.title,
      version: p.version,
      framework: p.framework,
      status: p.status,
      owner: p.owner,
    })),
    controlLibrarySample: controls.map((c) => ({
      code: c.controlCode || null,
      title: c.title,
      framework: c.framework,
      status: c.status,
    })),
  };

  return JSON.stringify(snapshot, null, 2);
}

export const SYSTEM_PROMPT = `You are CISO Copilot for NovaPay GRC — a Microsoft Copilot–style compliance assistant.

Rules:
- Answer in the same language the user writes (Ukrainian or English).
- Ground answers in the GRC context JSON when available. Prefer real project/control/policy names and statuses.
- Be concise and actionable for a CISO / compliance officer.
- Cover ISO 27001, PCI DSS, GDPR, DORA, NIS2, SOC 2, NIST CSF, and Ukrainian NBU regulations when relevant.
- If data is missing, say what is missing and suggest the next GRC step (import controls, attach evidence, update status).
- Do not invent audit evidence that is not in the context.
- Format with short bullets when listing gaps or steps.`;

type AzureConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
};

function azureConfig(): AzureConfig | null {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
  const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || '';
  if (!endpoint || !apiKey || !deployment) return null;
  return {
    endpoint,
    apiKey,
    deployment,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
  };
}

export function copilotProviderStatus(): {
  provider: 'azure_openai' | 'local_fallback';
  configured: boolean;
} {
  const cfg = azureConfig();
  return {
    provider: cfg ? 'azure_openai' : 'local_fallback',
    configured: Boolean(cfg),
  };
}

async function callAzureOpenAI(
  cfg: AzureConfig,
  messages: CopilotChatMessage[],
): Promise<string> {
  const url =
    `${cfg.endpoint}/openai/deployments/${encodeURIComponent(cfg.deployment)}` +
    `/chat/completions?api-version=${encodeURIComponent(cfg.apiVersion)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: 0.3,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Azure OpenAI error ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Azure OpenAI returned an empty response');
  return content;
}

/** Deterministic fallback when Azure OpenAI is not configured (pilot / offline). */
export function localFallbackReply(userMessage: string, contextJson: string): string {
  let context: {
    projectControlSummary?: {
      total?: number;
      byStatus?: Record<string, number>;
      withEvidence?: number;
      withoutEvidence?: number;
    };
    topGaps?: Array<{ code?: string | null; title: string; framework?: string; status: string }>;
    projects?: Array<{ name: string; status: string; company?: string }>;
    policies?: Array<{ title: string; status: string }>;
  } = {};

  try {
    context = JSON.parse(contextJson);
  } catch {
    /* ignore */
  }

  const lower = userMessage.toLowerCase();
  const summary = context.projectControlSummary;
  const gaps = context.topGaps || [];
  const projects = context.projects || [];

  if (lower.includes('gap') || lower.includes('прогал') || lower.includes('compliance')) {
    const byStatus = summary?.byStatus || {};
    const gapLines = gaps.slice(0, 8).map(
      (g) =>
        `- [${g.status}] ${g.code ? `${g.code} — ` : ''}${g.title}${g.framework ? ` (${g.framework})` : ''}`,
    );
    return [
      'Based on live GRC data, here is a compliance snapshot:',
      `- Project controls: ${summary?.total ?? 0}`,
      `- By status: ${JSON.stringify(byStatus)}`,
      `- With evidence: ${summary?.withEvidence ?? 0}; without: ${summary?.withoutEvidence ?? 0}`,
      '',
      gapLines.length ? 'Priority gaps:' : 'No open gaps in the current sample.',
      ...gapLines,
      '',
      'Tip: Configure AZURE_OPENAI_* env vars for full Microsoft Copilot–style reasoning.',
    ].join('\n');
  }

  if (lower.includes('project') || lower.includes('проект')) {
    if (!projects.length) return 'No projects found in the database yet. Create a project and import controls.';
    return [
      'Active projects:',
      ...projects.map((p) => `- ${p.name} (${p.status})${p.company ? ` — ${p.company}` : ''}`),
    ].join('\n');
  }

  if (lower.includes('pci') || lower.includes('iso') || lower.includes('nbu') || lower.includes('audit')) {
    const related = gaps
      .filter((g) => {
        const f = (g.framework || '').toLowerCase();
        return (
          (lower.includes('pci') && f.includes('pci')) ||
          (lower.includes('iso') && f.includes('iso')) ||
          (lower.includes('nbu') && f.includes('nbu')) ||
          true
        );
      })
      .slice(0, 6);
    return [
      'Relevant open controls from your GRC register:',
      ...(related.length
        ? related.map((g) => `- ${g.code || '—'} ${g.title} [${g.status}]`)
        : ['- No matching open controls in the current sample.']),
      '',
      'For deeper answers (SoA drafting, requirement walkthroughs), connect Azure OpenAI.',
    ].join('\n');
  }

  return [
    'I am CISO Copilot for NovaPay GRC.',
    summary
      ? `Live context: ${summary.total ?? 0} project controls, ${summary.withEvidence ?? 0} with evidence.`
      : 'Live GRC context loaded.',
    projects.length ? `Projects: ${projects.map((p) => p.name).join(', ')}.` : '',
    '',
    'Ask about compliance gaps, projects, PCI/ISO/NBU controls, or audit prep.',
    azureConfig()
      ? ''
      : 'Running in local fallback mode — set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT for Microsoft Copilot–grade answers.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runCopilotAgent(
  prisma: PrismaClient,
  history: CopilotChatMessage[],
  userMessage: string,
): Promise<{ reply: string; provider: 'azure_openai' | 'local_fallback' }> {
  const contextJson = await buildGrcContext(prisma);
  const messages: CopilotChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Current GRC context (JSON). Use only this data as factual ground truth:\n${contextJson}`,
    },
    ...history.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-12),
    { role: 'user', content: userMessage },
  ];

  const cfg = azureConfig();
  if (cfg) {
    const reply = await callAzureOpenAI(cfg, messages);
    return { reply, provider: 'azure_openai' };
  }

  return {
    reply: localFallbackReply(userMessage, contextJson),
    provider: 'local_fallback',
  };
}
