import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { registerProjectRoutes } from './projects.js';

const PORT = Number(process.env.PORT || 3100);
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());

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

app.post('/api/controls', async (req, res) => {
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
    res.status(201).json(serializeControl(created));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create control' });
  }
});

app.patch('/api/controls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const data: Record<string, string> = {};
    for (const key of ['controlCode', 'title', 'description', 'framework', 'category', 'status', 'owner', 'controlDesign', 'source', 'lastReviewed'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.evidence !== undefined) data.evidence = JSON.stringify(body.evidence);
    if (body.evidenceLinks !== undefined) data.evidenceLinks = JSON.stringify(body.evidenceLinks);
    if (body.attachments !== undefined) data.attachments = JSON.stringify(body.attachments);
    if (body.accessList !== undefined) data.accessList = JSON.stringify(body.accessList);

    const updated = await prisma.gRCControl.update({ where: { id }, data });
    res.json(serializeControl(updated));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update control' });
  }
});

app.delete('/api/controls/:id', async (req, res) => {
  try {
    await prisma.gRCControl.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete control' });
  }
});

registerProjectRoutes(app, prisma);

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
