import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { ZipArchive } from 'archiver';
import { requirePermission } from './auth/middleware.js';
import {
  PROJECT_FRAMEWORK_OPTIONS,
  filterControlsForFramework,
  findFrameworkOption,
} from './frameworks.js';
import { auditFromRequest, computeChanges } from './audit.js';
import rateLimit from 'express-rate-limit';
import {
  attachmentWriteLimiter,
  evidencePackageLimiter,
} from './rateLimit.js';
import {
  accessHasPermission,
  roleForCompany,
} from './auth/permissions.js';

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'projects')
);

export interface ControlAttachmentMeta {
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

function parseJsonObject(value: string, fallback: Record<string, unknown> = {}) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeAttachments(raw: unknown[]): ControlAttachmentMeta[] {
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
        mimeType: String(o.mimeType || ''),
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

function normalizeMitigation(raw: unknown): {
  enabled: boolean;
  title: string;
  description: string;
  category: string;
  assignee: string;
  dueDate: string;
  priority: string;
  status: string;
  taskId?: string;
} {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    enabled: Boolean(o.enabled),
    title: String(o.title || ''),
    description: String(o.description || ''),
    category: String(o.category || ''),
    assignee: String(o.assignee || ''),
    dueDate: String(o.dueDate || ''),
    priority: String(o.priority || 'medium'),
    status: String(o.status || 'remaining'),
    ...(o.taskId ? { taskId: String(o.taskId) } : {}),
  };
}

function serializeProjectControl(control: {
  evidence: string;
  evidenceLinks: string;
  attachments: string;
  accessList: string;
  mitigation?: string;
} & Record<string, unknown>) {
  return {
    ...control,
    evidence: parseJsonArray<string>(control.evidence),
    evidenceLinks: parseJsonArray<string>(control.evidenceLinks),
    attachments: normalizeAttachments(parseJsonArray(control.attachments)),
    accessList: parseJsonArray(control.accessList),
    mitigation: normalizeMitigation(parseJsonObject(control.mitigation || '{}')),
  };
}

function controlUploadDir(projectId: string, controlId: string) {
  return path.join(UPLOAD_ROOT, projectId, controlId);
}

/** Safe single path segment for ZIP entries (no path traversal). */
function safeZipSegment(name: string, fallback = 'file'): string {
  const cleaned = String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned || fallback;
}

function uniqueZipName(used: Set<string>, originalName: string): string {
  const base = safeZipSegment(originalName, 'attachment');
  if (!used.has(base.toLowerCase())) {
    used.add(base.toLowerCase());
    return base;
  }
  const ext = path.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  let i = 2;
  while (used.has(`${stem}-${i}${ext}`.toLowerCase())) i += 1;
  const next = `${stem}-${i}${ext}`;
  used.add(next.toLowerCase());
  return next;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = controlUploadDir(req.params.id, req.params.controlId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 32);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

function serializeProject(project: {
  team: string;
  scope: string;
  tasks: string;
  reviews: string;
  findings: string;
} & Record<string, unknown>, controlCount = 0) {
  return {
    ...project,
    team: parseJsonArray<string>(project.team),
    scope: parseJsonObject(project.scope, {
      businessUnits: [], systems: [], assets: [], frameworks: [], controls: [], policies: [], vendors: [],
    }),
    tasks: parseJsonArray(project.tasks),
    reviews: parseJsonArray(project.reviews),
    findings: parseJsonArray(project.findings),
    controlCount,
  };
}

export function registerProjectRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/frameworks', async (_req, res) => {
    try {
      const allControls = await prisma.gRCControl.findMany({
        select: { framework: true, source: true },
      });

      const frameworks = PROJECT_FRAMEWORK_OPTIONS.map(opt => {
        const matched = filterControlsForFramework(allControls, opt.name);
        return {
          name: opt.name,
          shortName: opt.shortName,
          count: matched.length,
        };
      });

      res.json(frameworks);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load frameworks' });
    }
  });

  app.get('/api/frameworks/controls', async (req, res) => {
    try {
      const framework = String(req.query.framework || '').trim();
      if (!framework) {
        return res.status(400).json({ error: 'framework query parameter is required' });
      }
      const allControls = await prisma.gRCControl.findMany({
        orderBy: [{ controlCode: 'asc' }, { title: 'asc' }],
      });
      const matched = filterControlsForFramework(allControls, framework);
      res.json(matched.map(c => ({
        id: c.id,
        controlCode: c.controlCode,
        title: c.title,
        description: c.description,
        framework: c.framework,
        category: c.category,
        source: c.source,
        status: c.status,
        owner: c.owner,
      })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load framework controls' });
    }
  });

  app.get('/api/projects', async (req, res) => {
    try {
      const projects = await prisma.project.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { projectControls: true } } },
      });
      const allowed = req.user
        ? projects.filter(p => roleForCompany(req.user!.companies, p.company) !== null)
        : [];
      res.json(allowed.map(p => serializeProject(p, p._count.projectControls)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load projects' });
    }
  });

  app.post('/api/projects', requirePermission('projects:write'), async (req, res) => {
    try {
      const body = req.body;
      const framework = String(body.framework || '').trim();
      if (!framework) {
        return res.status(400).json({ error: 'Framework is required' });
      }

      const company = String(body.company || 'NovaPay LLC').trim();
      if (!accessHasPermission(req.user?.companies || {}, 'projects:write', company)) {
        return res.status(403).json({ error: 'No write access to this company' });
      }

      const allControls = await prisma.gRCControl.findMany({
        orderBy: [{ controlCode: 'asc' }, { title: 'asc' }],
      });
      const frameworkControls = filterControlsForFramework(allControls, framework);
      const frameworkMeta = findFrameworkOption(framework);
      const projectFramework = frameworkMeta?.name || framework;

      // controlIds: string[] — selected controls; omit = all; [] = none
      let masterControls = frameworkControls;
      if (Array.isArray(body.controlIds)) {
        const idSet = new Set(body.controlIds.map((id: unknown) => String(id)));
        masterControls = frameworkControls.filter(c => idSet.has(c.id));
        if (body.controlIds.length > 0 && masterControls.length === 0) {
          return res.status(400).json({ error: 'None of the selected controls belong to this framework' });
        }
      } else if (frameworkControls.length === 0) {
        return res.status(400).json({
          error: `No controls found in Controls Repository for framework: ${framework}. Select another framework or create the project and add custom controls later.`,
        });
      }

      const scope = {
        businessUnits: [],
        systems: [],
        assets: [],
        frameworks: [projectFramework],
        controls: masterControls.map(c => c.controlCode || c.title),
        policies: [],
        vendors: [],
      };

      const project = await prisma.project.create({
        data: {
          title: body.title,
          company: company || 'NovaPay LLC',
          type: body.type || 'audit',
          framework: projectFramework,
          status: body.status || 'created',
          description: body.description || '',
          owner: body.owner || '',
          team: JSON.stringify(body.team || []),
          scope: JSON.stringify(scope),
          tasks: JSON.stringify([]),
          reviews: JSON.stringify([]),
          findings: JSON.stringify([]),
          startDate: body.startDate || '',
          targetDate: body.targetDate || '',
          progress: 0,
        },
      });

      const batchSize = 100;
      for (let i = 0; i < masterControls.length; i += batchSize) {
        const batch = masterControls.slice(i, i + batchSize).map(c => ({
          projectId: project.id,
          sourceControlId: c.id,
          controlCode: c.controlCode || '',
          title: c.title,
          description: c.description,
          framework: projectFramework,
          category: c.category,
          status: c.status || 'pending',
          owner: c.owner,
          evidence: c.evidence,
          evidenceLinks: c.evidenceLinks,
          attachments: c.attachments,
          controlDesign: c.controlDesign,
          source: c.source,
          accessList: c.accessList,
          lastReviewed: c.lastReviewed,
        }));
        await prisma.projectControl.createMany({ data: batch });
      }

      const count = await prisma.projectControl.count({ where: { projectId: project.id } });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'create',
        entityType: 'project',
        entityId: project.id,
        entityLabel: project.title,
        summary: `Created project "${project.title}" (${project.company}, ${project.framework}) with ${count} controls`,
        changes: {
          title: { from: null, to: project.title },
          company: { from: null, to: project.company },
          framework: { from: null, to: project.framework },
          status: { from: null, to: project.status },
        },
        metadata: { controlCount: count },
      });

      res.status(201).json(serializeProject(project, count));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { projectControls: true } } },
      });
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (roleForCompany(req.user?.companies || {}, project.company) === null) {
        return res.status(403).json({ error: 'No access to this company' });
      }
      res.json(serializeProject(project, project._count.projectControls));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load project' });
    }
  });

  app.patch('/api/projects/:id', requirePermission('projects:write'), async (req, res) => {
    try {
      const body = req.body;
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Project not found' });

      const data: Record<string, string | number> = {};
      for (const key of ['title', 'company', 'type', 'framework', 'status', 'description', 'owner', 'startDate', 'targetDate', 'completedAt'] as const) {
        if (body[key] !== undefined) data[key] = body[key];
      }
      if (body.progress !== undefined) data.progress = Number(body.progress);
      if (body.team !== undefined) data.team = JSON.stringify(body.team);
      if (body.scope !== undefined) data.scope = JSON.stringify(body.scope);
      if (body.tasks !== undefined) data.tasks = JSON.stringify(body.tasks);
      if (body.reviews !== undefined) data.reviews = JSON.stringify(body.reviews);
      if (body.findings !== undefined) data.findings = JSON.stringify(body.findings);

      const project = await prisma.project.update({ where: { id: req.params.id }, data });
      const count = await prisma.projectControl.count({ where: { projectId: project.id } });

      const fields = ['title', 'company', 'type', 'framework', 'status', 'description', 'owner', 'startDate', 'targetDate', 'completedAt', 'progress', 'team', 'scope', 'tasks', 'reviews', 'findings'];
      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'update',
        entityType: 'project',
        entityId: project.id,
        entityLabel: project.title,
        summary: `Updated project "${project.title}"`,
        changes: computeChanges(
          existing as unknown as Record<string, unknown>,
          project as unknown as Record<string, unknown>,
          fields,
        ),
      });

      res.json(serializeProject(project, count));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.delete('/api/projects/:id', requirePermission('projects:delete'), async (req, res) => {
    try {
      const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Project not found' });

      await prisma.project.delete({ where: { id: req.params.id } });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'delete',
        severity: 'warning',
        entityType: 'project',
        entityId: existing.id,
        entityLabel: existing.title,
        summary: `Deleted project "${existing.title}"`,
        changes: {
          title: { from: existing.title, to: null },
          company: { from: existing.company, to: null },
          framework: { from: existing.framework, to: null },
        },
      });

      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  app.get('/api/projects/:id/controls', async (req, res) => {
    try {
      const controls = await prisma.projectControl.findMany({
        where: { projectId: req.params.id },
        orderBy: [{ controlCode: 'asc' }, { title: 'asc' }],
      });
      res.json(controls.map(serializeProjectControl));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load project controls' });
    }
  });

  app.post('/api/projects/:id/controls', requirePermission('project-controls:write'), async (req, res) => {
    try {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const body = req.body || {};
      const createdControls: ReturnType<typeof serializeProjectControl>[] = [];

      const sourceIds: string[] = Array.isArray(body.sourceControlIds)
        ? body.sourceControlIds.map((id: unknown) => String(id))
        : body.sourceControlId
          ? [String(body.sourceControlId)]
          : [];

      if (sourceIds.length > 0) {
        const masters = await prisma.gRCControl.findMany({ where: { id: { in: sourceIds } } });
        if (masters.length === 0) {
          return res.status(400).json({ error: 'No matching controls found in Controls Repository' });
        }

        const existing = await prisma.projectControl.findMany({
          where: { projectId: project.id, sourceControlId: { in: sourceIds } },
          select: { sourceControlId: true },
        });
        const already = new Set(existing.map(e => e.sourceControlId));
        const toAdd = masters.filter(m => !already.has(m.id));

        for (const c of toAdd) {
          const fwMeta = findFrameworkOption(c.framework) || findFrameworkOption(String(body.framework || ''));
          const fw = fwMeta?.name || c.framework || project.framework;
          const row = await prisma.projectControl.create({
            data: {
              projectId: project.id,
              sourceControlId: c.id,
              controlCode: c.controlCode || '',
              title: c.title,
              description: c.description,
              framework: fw,
              category: c.category,
              status: c.status || 'pending',
              owner: c.owner,
              evidence: c.evidence,
              evidenceLinks: c.evidenceLinks,
              attachments: c.attachments,
              controlDesign: c.controlDesign,
              source: c.source,
              accessList: c.accessList,
              lastReviewed: c.lastReviewed,
            },
          });
          createdControls.push(serializeProjectControl(row));
        }
      } else if (body.title) {
        // Custom / manual control (not in library)
        const title = String(body.title).trim();
        if (!title) return res.status(400).json({ error: 'Title is required for a custom control' });
        const fwMeta = findFrameworkOption(String(body.framework || project.framework || ''));
        const fw = fwMeta?.name || String(body.framework || project.framework || 'Other');
        const row = await prisma.projectControl.create({
          data: {
            projectId: project.id,
            sourceControlId: '',
            controlCode: String(body.controlCode || '').trim(),
            title,
            description: String(body.description || ''),
            framework: fw,
            category: String(body.category || ''),
            status: String(body.status || 'pending'),
            owner: String(body.owner || ''),
            evidence: '[]',
            evidenceLinks: '[]',
            attachments: '[]',
            controlDesign: String(body.controlDesign || ''),
            source: String(body.source || 'Custom'),
            accessList: '[]',
            lastReviewed: '',
          },
        });
        createdControls.push(serializeProjectControl(row));
      } else {
        return res.status(400).json({
          error: 'Provide sourceControlId / sourceControlIds from the library, or title for a custom control',
        });
      }

      // Keep project.scope.frameworks / controls in sync
      const scope = parseJsonObject(project.scope, {
        businessUnits: [], systems: [], assets: [], frameworks: [], controls: [], policies: [], vendors: [],
      }) as {
        businessUnits: string[]; systems: string[]; assets: string[];
        frameworks: string[]; controls: string[]; policies: string[]; vendors: string[];
      };
      const fwSet = new Set(scope.frameworks || []);
      const ctrlSet = new Set(scope.controls || []);
      for (const c of createdControls) {
        const fw = String(c.framework || '');
        if (fw) fwSet.add(fw);
        ctrlSet.add(String(c.controlCode || c.title || ''));
      }
      await prisma.project.update({
        where: { id: project.id },
        data: {
          scope: JSON.stringify({
            ...scope,
            frameworks: [...fwSet],
            controls: [...ctrlSet].filter(Boolean),
          }),
        },
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'create',
        entityType: 'project_control',
        entityId: createdControls.map(c => c.id).join(','),
        entityLabel: createdControls.map(c => c.controlCode || c.title).join(', '),
        summary: `Added ${createdControls.length} control(s) to project "${project.title}"`,
        metadata: {
          projectId: project.id,
          projectTitle: project.title,
          controlIds: createdControls.map(c => c.id),
          count: createdControls.length,
        },
      });

      res.status(201).json(createdControls.length === 1 ? createdControls[0] : createdControls);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add project control' });
    }
  });

  app.delete('/api/projects/:id/controls/:controlId', requirePermission('project-controls:write'), attachmentWriteLimiter, async (req, res) => {
    try {
      const existing = await prisma.projectControl.findFirst({
        where: { id: req.params.controlId, projectId: req.params.id },
      });
      if (!existing) return res.status(404).json({ error: 'Project control not found' });

      const dir = controlUploadDir(req.params.id, req.params.controlId);
      if (fs.existsSync(dir)) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
      await prisma.projectControl.delete({ where: { id: existing.id } });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'delete',
        severity: 'warning',
        entityType: 'project_control',
        entityId: existing.id,
        entityLabel: existing.controlCode || existing.title,
        summary: `Removed control "${existing.controlCode || existing.title}" from project`,
        metadata: { projectId: req.params.id },
        changes: {
          title: { from: existing.title, to: null },
          status: { from: existing.status, to: null },
        },
      });

      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete project control' });
    }
  });

  app.patch('/api/projects/:id/controls/:controlId', requirePermission('project-controls:write', 'project-controls:review'), async (req, res) => {
    try {
      const body = req.body;
      const existing = await prisma.projectControl.findFirst({
        where: { id: req.params.controlId, projectId: req.params.id },
      });
      if (!existing) return res.status(404).json({ error: 'Project control not found' });

      const data: Record<string, string> = {};
      for (const key of ['title', 'description', 'framework', 'category', 'status', 'owner', 'controlDesign', 'source', 'lastReviewed', 'controlCode'] as const) {
        if (body[key] !== undefined) data[key] = body[key];
      }
      if (body.evidence !== undefined) data.evidence = JSON.stringify(body.evidence);
      if (body.evidenceLinks !== undefined) data.evidenceLinks = JSON.stringify(body.evidenceLinks);
      if (body.attachments !== undefined) data.attachments = JSON.stringify(body.attachments);
      if (body.accessList !== undefined) data.accessList = JSON.stringify(body.accessList);
      if (body.mitigation !== undefined) data.mitigation = JSON.stringify(normalizeMitigation(body.mitigation));

      const updated = await prisma.projectControl.update({ where: { id: existing.id }, data });

      const fields = [
        'title', 'description', 'framework', 'category', 'status', 'owner',
        'controlDesign', 'source', 'lastReviewed', 'controlCode',
        'evidence', 'evidenceLinks', 'attachments', 'accessList', 'mitigation',
      ];
      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'update',
        entityType: 'project_control',
        entityId: updated.id,
        entityLabel: updated.controlCode || updated.title,
        summary: `Updated project control "${updated.controlCode || updated.title}"`,
        changes: computeChanges(
          existing as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>,
          fields,
        ),
        metadata: { projectId: req.params.id },
      });

      res.json(serializeProjectControl(updated));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update project control' });
    }
  });

  app.post(
    '/api/projects/:id/controls/:controlId/attachments',
    requirePermission('project-controls:attachments'),
    attachmentWriteLimiter,
    upload.array('files', 10),
    async (req, res) => {
      try {
        const existing = await prisma.projectControl.findFirst({
          where: { id: req.params.controlId, projectId: req.params.id },
        });
        if (!existing) return res.status(404).json({ error: 'Project control not found' });

        const files = (req.files as Express.Multer.File[]) || [];
        if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

        const current = normalizeAttachments(parseJsonArray(existing.attachments));
        const added: ControlAttachmentMeta[] = files.map(f => ({
          id: crypto.randomUUID(),
          name: f.originalname,
          storedName: f.filename,
          size: f.size,
          mimeType: f.mimetype || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
        }));

        const updated = await prisma.projectControl.update({
          where: { id: existing.id },
          data: { attachments: JSON.stringify([...current, ...added]) },
        });

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'upload',
          entityType: 'attachment',
          entityId: existing.id,
          entityLabel: existing.controlCode || existing.title,
          summary: `Uploaded ${added.length} file(s) to control "${existing.controlCode || existing.title}"`,
          metadata: {
            projectId: req.params.id,
            controlId: existing.id,
            files: added.map(a => ({ id: a.id, name: a.name, size: a.size })),
          },
        });

        res.status(201).json(serializeProjectControl(updated));
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload attachments' });
      }
    }
  );

  // Inline rateLimit() so CodeQL js/missing-rate-limiting sees the guard on res.download.
  app.get(
    '/api/projects/:id/controls/:controlId/attachments/:attachmentId',
    rateLimit({
      windowMs: 60_000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many attachment downloads. Please try again later.' },
    }),
    async (req, res) => {
      try {
        const existing = await prisma.projectControl.findFirst({
          where: { id: req.params.controlId, projectId: req.params.id },
        });
        if (!existing) return res.status(404).json({ error: 'Project control not found' });

        const attachments = normalizeAttachments(parseJsonArray(existing.attachments));
        const att = attachments.find(a => a.id === req.params.attachmentId);
        if (!att || !att.storedName) return res.status(404).json({ error: 'Attachment not found' });

        const filePath = path.join(controlUploadDir(req.params.id, req.params.controlId), att.storedName);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

        res.download(filePath, att.name);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to download attachment' });
      }
    },
  );

  // Audit evidence package: report manifest + all uploaded attachments as ZIP
  app.get('/api/projects/:id/evidence-package', evidencePackageLimiter, async (req, res) => {
    try {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (roleForCompany(req.user?.companies || {}, project.company) === null) {
        return res.status(403).json({ error: 'No access to this company' });
      }

      const controls = await prisma.projectControl.findMany({
        where: { projectId: project.id },
        orderBy: [{ category: 'asc' }, { controlCode: 'asc' }, { title: 'asc' }],
      });

      const generatedAt = new Date().toISOString();
      const stamp = generatedAt.slice(0, 10);
      const zipFileName = `evidence-package_${safeZipSegment(project.title, 'project')}_${stamp}.zip`;

      const folderUsed = new Set<string>();
      const controlEntries: Array<{
        controlId: string;
        controlCode: string;
        title: string;
        category: string;
        status: string;
        owner: string;
        evidence: string[];
        evidenceLinks: string[];
        folder: string;
        attachments: Array<{
          id: string;
          name: string;
          zipPath: string | null;
          size: number;
          mimeType: string;
          uploadedAt: string;
          presentOnDisk: boolean;
        }>;
      }> = [];

      let filesAdded = 0;
      let missingFiles = 0;

      type PendingFile = { absPath: string; zipPath: string };
      const pendingFiles: PendingFile[] = [];

      for (const raw of controls) {
        const serialized = serializeProjectControl(raw);
        const codeOrTitle = serialized.controlCode || serialized.title || serialized.id;
        let folder = safeZipSegment(String(codeOrTitle), 'control');
        if (folderUsed.has(folder.toLowerCase())) {
          folder = uniqueZipName(folderUsed, folder);
        } else {
          folderUsed.add(folder.toLowerCase());
        }

        const nameUsed = new Set<string>();
        const attachmentRows: (typeof controlEntries)[number]['attachments'] = [];

        for (const att of serialized.attachments as ControlAttachmentMeta[]) {
          const fileName = uniqueZipName(nameUsed, att.name || att.storedName || 'file');
          const absPath = att.storedName
            ? path.join(controlUploadDir(project.id, String(serialized.id)), att.storedName)
            : '';
          const presentOnDisk = Boolean(absPath && fs.existsSync(absPath));
          const zipPath = presentOnDisk ? `evidence/${folder}/${fileName}` : null;
          if (presentOnDisk && zipPath) {
            pendingFiles.push({ absPath, zipPath });
            filesAdded += 1;
          } else {
            missingFiles += 1;
          }
          attachmentRows.push({
            id: att.id,
            name: att.name,
            zipPath,
            size: att.size,
            mimeType: att.mimeType,
            uploadedAt: att.uploadedAt,
            presentOnDisk,
          });
        }

        controlEntries.push({
          controlId: String(serialized.id),
          controlCode: String(serialized.controlCode || ''),
          title: String(serialized.title || ''),
          category: String(serialized.category || ''),
          status: String(serialized.status || ''),
          owner: String(serialized.owner || ''),
          evidence: serialized.evidence as string[],
          evidenceLinks: serialized.evidenceLinks as string[],
          folder: `evidence/${folder}`,
          attachments: attachmentRows,
        });
      }

      const manifest = {
        generatedAt,
        generator: 'NovaPay GRC evidence package',
        project: {
          id: project.id,
          title: project.title,
          company: project.company,
          framework: project.framework,
          status: project.status,
          owner: project.owner,
          description: project.description,
          startDate: project.startDate,
          targetDate: project.targetDate,
        },
        stats: {
          controls: controlEntries.length,
          attachmentsListed: controlEntries.reduce((n, c) => n + c.attachments.length, 0),
          filesInZip: filesAdded,
          missingFiles,
          evidenceLabels: controlEntries.reduce((n, c) => n + c.evidence.length, 0),
          evidenceLinks: controlEntries.reduce((n, c) => n + c.evidenceLinks.length, 0),
        },
        controls: controlEntries,
      };

      const reportLines = [
        'NovaPay GRC — Project Evidence Package',
        '='.repeat(48),
        `Generated: ${generatedAt}`,
        `Project:   ${project.title}`,
        `Company:   ${project.company}`,
        `Framework: ${project.framework}`,
        `Status:    ${project.status}`,
        `Owner:     ${project.owner}`,
        '',
        `Controls: ${manifest.stats.controls}`,
        `Attachment files in ZIP: ${manifest.stats.filesInZip}`,
        `Missing on disk: ${manifest.stats.missingFiles}`,
        `Evidence labels: ${manifest.stats.evidenceLabels}`,
        `Evidence links: ${manifest.stats.evidenceLinks}`,
        '',
        'Folder layout: evidence/<control-code>/<file>',
        'Machine-readable index: MANIFEST.json',
        '',
      ];

      for (const c of controlEntries) {
        reportLines.push('-'.repeat(48));
        reportLines.push(`${c.controlCode ? `${c.controlCode} — ` : ''}${c.title}`);
        reportLines.push(`Status: ${c.status} | Owner: ${c.owner || '—'} | Category: ${c.category || '—'}`);
        if (c.evidence.length) {
          reportLines.push('Evidence labels:');
          for (const e of c.evidence) reportLines.push(`  - ${e}`);
        }
        if (c.evidenceLinks.length) {
          reportLines.push('Evidence links:');
          for (const link of c.evidenceLinks) reportLines.push(`  - ${link}`);
        }
        if (c.attachments.length) {
          reportLines.push('Attachments:');
          for (const a of c.attachments) {
            reportLines.push(
              `  - ${a.name}${a.zipPath ? ` → ${a.zipPath}` : ' (MISSING ON DISK)'}`,
            );
          }
        } else if (!c.evidence.length && !c.evidenceLinks.length) {
          reportLines.push('No evidence recorded.');
        }
        reportLines.push('');
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${zipFileName.replace(/"/g, '')}"`,
      );

      const archive = new ZipArchive({ zlib: { level: 9 } });
      archive.on('error', (err) => {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to build evidence package' });
        else res.end();
      });
      archive.pipe(res);

      archive.append(JSON.stringify(manifest, null, 2), { name: 'MANIFEST.json' });
      archive.append(reportLines.join('\n'), { name: 'REPORT.txt' });

      for (const file of pendingFiles) {
        archive.file(file.absPath, { name: file.zipPath });
      }

      await archive.finalize();

      try {
        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'download',
          entityType: 'project',
          entityId: project.id,
          entityLabel: project.title,
          summary: `Downloaded evidence package for project "${project.title}" (${filesAdded} files)`,
          metadata: {
            filesInZip: filesAdded,
            missingFiles,
            controls: controlEntries.length,
          },
        });
      } catch (auditError) {
        console.error('Failed to audit evidence package download', auditError);
      }
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to build evidence package' });
    }
  });

  app.delete('/api/projects/:id/controls/:controlId/attachments/:attachmentId', requirePermission('project-controls:attachments'), attachmentWriteLimiter, async (req, res) => {
    try {
      const existing = await prisma.projectControl.findFirst({
        where: { id: req.params.controlId, projectId: req.params.id },
      });
      if (!existing) return res.status(404).json({ error: 'Project control not found' });

      const attachments = normalizeAttachments(parseJsonArray(existing.attachments));
      const att = attachments.find(a => a.id === req.params.attachmentId);
      if (!att) return res.status(404).json({ error: 'Attachment not found' });

      if (att.storedName) {
        const filePath = path.join(controlUploadDir(req.params.id, req.params.controlId), att.storedName);
        try { fs.unlinkSync(filePath); } catch { /* ignore missing file */ }
      }

      const next = attachments.filter(a => a.id !== att.id);
      const updated = await prisma.projectControl.update({
        where: { id: existing.id },
        data: { attachments: JSON.stringify(next) },
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'delete',
        severity: 'warning',
        entityType: 'attachment',
        entityId: att.id,
        entityLabel: att.name,
        summary: `Deleted attachment "${att.name}" from control "${existing.controlCode || existing.title}"`,
        metadata: {
          projectId: req.params.id,
          controlId: existing.id,
          fileName: att.name,
        },
      });

      res.json(serializeProjectControl(updated));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete attachment' });
    }
  });
}
