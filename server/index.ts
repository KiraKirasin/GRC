import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { registerProjectRoutes } from './projects.js';
import { registerPolicyRoutes } from './policies.js';
import { authenticateUnlessPublic } from './auth/middleware.js';
import { registerAuthRoutes } from './auth/routes.js';
import { requirePermission } from './auth/middleware.js';
import { registerAuditRoutes } from './audit-routes.js';
import { auditFromRequest, computeChanges } from './audit.js';

const PORT = Number(process.env.PORT || 3100);
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticateUnlessPublic);

registerAuthRoutes(app, prisma);
registerAuditRoutes(app, prisma);

function parseJsonArray<T>(value: string, fallback: T[] = []): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function serializeControl(control: NonNullable<Awaited<ReturnType<typeof prisma.gRCControl.findFirst>>>) {
  return {
    ...control,
    evidence: parseJsonArray<string>(control.evidence),
    evidenceLinks: parseJsonArray<string>(control.evidenceLinks),
    attachments: parseJsonArray<string>(control.attachments),
    accessList: parseJsonArray(control.accessList),
  };
}

const CONTROL_AUDIT_FIELDS = [
  'controlCode', 'title', 'description', 'framework', 'category', 'status',
  'owner', 'evidence', 'evidenceLinks', 'attachments', 'controlDesign',
  'source', 'accessList', 'lastReviewed',
] as const;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/controls', async (_req, res) => {
  try {
    const controls = await prisma.gRCControl.findMany({ orderBy: { title: 'asc' } });
    res.json(controls.map(c => serializeControl(c)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load controls' });
  }
});

app.post('/api/controls', requirePermission('controls:write'), async (req, res) => {
  try {
    const body = req.body;
    const created = await prisma.gRCControl.create({
      data: {
        controlCode: body.controlCode || '',
        title: body.title,
        description: body.description || '',
        framework: body.framework || '',
        category: body.category || '',
        status: body.status || 'pending',
        owner: body.owner || '',
        evidence: JSON.stringify(body.evidence || []),
        evidenceLinks: JSON.stringify(body.evidenceLinks || []),
        attachments: JSON.stringify(body.attachments || []),
        controlDesign: body.controlDesign || '',
        source: body.source || '',
        accessList: JSON.stringify(body.accessList || []),
        lastReviewed: body.lastReviewed || '',
      },
    });

    await auditFromRequest(prisma, req, {
      category: 'data',
      action: 'create',
      entityType: 'control',
      entityId: created.id,
      entityLabel: created.controlCode || created.title,
      summary: `Created control ${created.controlCode || created.title}`,
      changes: {
        title: { from: null, to: created.title },
        framework: { from: null, to: created.framework },
        category: { from: null, to: created.category },
        status: { from: null, to: created.status },
      },
    });

    res.status(201).json(serializeControl(created));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create control' });
  }
});

app.patch('/api/controls/:id', requirePermission('controls:write'), async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const existing = await prisma.gRCControl.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Control not found' });

    const data: Record<string, string> = {};
    for (const key of ['controlCode', 'title', 'description', 'framework', 'category', 'status', 'owner', 'controlDesign', 'source', 'lastReviewed'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.evidence !== undefined) data.evidence = JSON.stringify(body.evidence);
    if (body.evidenceLinks !== undefined) data.evidenceLinks = JSON.stringify(body.evidenceLinks);
    if (body.attachments !== undefined) data.attachments = JSON.stringify(body.attachments);
    if (body.accessList !== undefined) data.accessList = JSON.stringify(body.accessList);

    const updated = await prisma.gRCControl.update({ where: { id }, data });

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of CONTROL_AUDIT_FIELDS) {
      before[key] = existing[key];
      after[key] = updated[key];
    }

    await auditFromRequest(prisma, req, {
      category: 'data',
      action: 'update',
      entityType: 'control',
      entityId: updated.id,
      entityLabel: updated.controlCode || updated.title,
      summary: `Updated control ${updated.controlCode || updated.title}`,
      changes: computeChanges(before, after, [...CONTROL_AUDIT_FIELDS]),
    });

    res.json(serializeControl(updated));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update control' });
  }
});

app.delete('/api/controls/:id', requirePermission('controls:delete'), async (req, res) => {
  try {
    const existing = await prisma.gRCControl.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Control not found' });

    await prisma.gRCControl.delete({ where: { id: req.params.id } });

    await auditFromRequest(prisma, req, {
      category: 'data',
      action: 'delete',
      severity: 'warning',
      entityType: 'control',
      entityId: existing.id,
      entityLabel: existing.controlCode || existing.title,
      summary: `Deleted control ${existing.controlCode || existing.title}`,
      changes: {
        title: { from: existing.title, to: null },
        framework: { from: existing.framework, to: null },
      },
    });

    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete control' });
  }
});

registerProjectRoutes(app, prisma);
registerPolicyRoutes(app, prisma);

// Production: serve built SPA from Vite `dist/`
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`GRC API listening on http://localhost:${PORT}`);
});
