import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { requirePermission } from './auth/middleware.js';
import { auditFromRequest, computeChanges } from './audit.js';

const UPLOAD_ROOT = path.resolve(
  process.env.POLICY_UPLOAD_DIR ||
    path.join(process.cwd(), 'uploads', 'policies')
);

export interface PolicyAttachmentMeta {
  id: string;
  name: string;
  storedName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

function parseJsonArray<T>(value: string, fallback: T[] = []): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeAttachments(raw: unknown[]): PolicyAttachmentMeta[] {
  return raw.map((item, i) => {
    if (typeof item === 'string') {
      return {
        id: `legacy-${i}`,
        name: item,
        storedName: '',
        size: 0,
        mimeType: '',
        uploadedAt: '',
      };
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      return {
        id: String(o.id || `att-${i}`),
        name: String(o.name || 'file'),
        storedName: String(o.storedName || ''),
        size: Number(o.size || 0),
        mimeType: String(o.mimeType || o.type || ''),
        uploadedAt: String(o.uploadedAt || ''),
      };
    }
    return {
      id: `unknown-${i}`,
      name: 'file',
      storedName: '',
      size: 0,
      mimeType: '',
      uploadedAt: '',
    };
  });
}

function policyDir(policyId: string) {
  return path.join(UPLOAD_ROOT, policyId);
}

function serializePolicy(policy: {
  id: string;
  title: string;
  version: string;
  status: string;
  framework: string;
  owner: string;
  description: string;
  lastReviewed: string;
  links: string;
  attachments: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: policy.id,
    title: policy.title,
    version: policy.version,
    status: policy.status,
    framework: policy.framework,
    owner: policy.owner,
    description: policy.description,
    lastReviewed: policy.lastReviewed,
    links: parseJsonArray<string>(policy.links).filter((l) => typeof l === 'string' && l.trim()),
    attachments: normalizeAttachments(parseJsonArray(policy.attachments)),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = policyDir(String(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-()+ ]+/g, '_');
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

export function registerPolicyRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/policies', async (_req, res) => {
    try {
      const rows = await prisma.policy.findMany({ orderBy: { title: 'asc' } });
      res.json(rows.map(serializePolicy));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load policies' });
    }
  });

  app.post('/api/policies', requirePermission('policies:write'), async (req, res) => {
    try {
      const body = req.body || {};
      const created = await prisma.policy.create({
        data: {
          title: String(body.title || '').trim() || 'Untitled policy',
          version: String(body.version || '1.0'),
          status: String(body.status || 'draft'),
          framework: String(body.framework || ''),
          owner: String(body.owner || ''),
          description: String(body.description || ''),
          lastReviewed: String(body.lastReviewed || ''),
          links: JSON.stringify(
            Array.isArray(body.links)
              ? body.links.filter((l: unknown) => typeof l === 'string' && String(l).trim())
              : []
          ),
          attachments: JSON.stringify([]),
        },
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'create',
        entityType: 'policy',
        entityId: created.id,
        entityLabel: created.title,
        summary: `Created policy "${created.title}"`,
        changes: {
          title: { from: null, to: created.title },
          status: { from: null, to: created.status },
        },
      });

      res.status(201).json(serializePolicy(created));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create policy' });
    }
  });

  app.patch('/api/policies/:id', requirePermission('policies:write'), async (req, res) => {
    try {
      const existing = await prisma.policy.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Policy not found' });

      const body = req.body || {};
      const data: Record<string, string> = {};
      for (const key of [
        'title', 'version', 'status', 'framework', 'owner', 'description', 'lastReviewed',
      ] as const) {
        if (body[key] !== undefined) data[key] = String(body[key] ?? '');
      }
      if (body.links !== undefined) {
        data.links = JSON.stringify(
          Array.isArray(body.links)
            ? body.links.filter((l: unknown) => typeof l === 'string' && String(l).trim())
            : []
        );
      }

      const updated = await prisma.policy.update({
        where: { id: existing.id },
        data,
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'update',
        entityType: 'policy',
        entityId: updated.id,
        entityLabel: updated.title,
        summary: `Updated policy "${updated.title}"`,
        changes: computeChanges(
          serializePolicy(existing) as unknown as Record<string, unknown>,
          serializePolicy(updated) as unknown as Record<string, unknown>,
          ['title', 'version', 'status', 'framework', 'owner', 'description', 'lastReviewed', 'links'],
        ),
      });

      res.json(serializePolicy(updated));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update policy' });
    }
  });

  app.delete('/api/policies/:id', requirePermission('policies:write'), async (req, res) => {
    try {
      const existing = await prisma.policy.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Policy not found' });

      await prisma.policy.delete({ where: { id: existing.id } });

      const dir = policyDir(existing.id);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'delete',
        entityType: 'policy',
        entityId: existing.id,
        entityLabel: existing.title,
        summary: `Deleted policy "${existing.title}"`,
      });

      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete policy' });
    }
  });

  app.post(
    '/api/policies/:id/attachments',
    requirePermission('policies:write'),
    upload.array('files', 10),
    async (req, res) => {
      try {
        const existing = await prisma.policy.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Policy not found' });

        const files = (req.files as Express.Multer.File[]) || [];
        if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

        const current = normalizeAttachments(parseJsonArray(existing.attachments));
        const added: PolicyAttachmentMeta[] = files.map((f) => ({
          id: crypto.randomUUID(),
          name: f.originalname,
          storedName: f.filename,
          size: f.size,
          mimeType: f.mimetype || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
        }));

        const updated = await prisma.policy.update({
          where: { id: existing.id },
          data: { attachments: JSON.stringify([...current, ...added]) },
        });

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'upload',
          entityType: 'policy-attachment',
          entityId: existing.id,
          entityLabel: existing.title,
          summary: `Uploaded ${added.length} file(s) to policy "${existing.title}"`,
        });

        res.json(serializePolicy(updated));
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload attachments' });
      }
    },
  );

  app.get('/api/policies/:id/attachments/:attachmentId', async (req, res) => {
    try {
      const existing = await prisma.policy.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Policy not found' });

      const attachments = normalizeAttachments(parseJsonArray(existing.attachments));
      const att = attachments.find((a) => a.id === req.params.attachmentId);
      if (!att || !att.storedName) return res.status(404).json({ error: 'Attachment not found' });

      const filePath = path.join(policyDir(existing.id), att.storedName);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

      res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(att.name)}"`,
      );
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to download attachment' });
    }
  });

  app.delete(
    '/api/policies/:id/attachments/:attachmentId',
    requirePermission('policies:write'),
    async (req, res) => {
      try {
        const existing = await prisma.policy.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Policy not found' });

        const attachments = normalizeAttachments(parseJsonArray(existing.attachments));
        const att = attachments.find((a) => a.id === req.params.attachmentId);
        if (!att) return res.status(404).json({ error: 'Attachment not found' });

        if (att.storedName) {
          const filePath = path.join(policyDir(existing.id), att.storedName);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        const next = attachments.filter((a) => a.id !== att.id);
        const updated = await prisma.policy.update({
          where: { id: existing.id },
          data: { attachments: JSON.stringify(next) },
        });

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'delete',
          entityType: 'policy-attachment',
          entityId: existing.id,
          entityLabel: existing.title,
          summary: `Deleted attachment "${att.name}" from policy "${existing.title}"`,
        });

        res.json(serializePolicy(updated));
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete attachment' });
      }
    },
  );
}
