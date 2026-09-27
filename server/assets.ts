import type { Express, Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from './auth/middleware.js';
import { canLinkRegistryToProject, roleForCompany } from './auth/permissions.js';
import { auditFromRequest, computeChanges } from './audit.js';

const ASSET_FIELDS = [
  'name',
  'purpose',
  'supportOwner',
  'criticality',
  'vendor',
  'consumers',
  'info',
] as const;

function normalizeCriticality(raw: string): string {
  const v = raw.toLowerCase();
  if (['low', 'низк', 'низкая', 'низький'].some((x) => v.includes(x))) return 'low';
  if (['high', 'высок', 'високий', 'высокая'].some((x) => v.includes(x))) return 'high';
  if (['critical', 'критич'].some((x) => v.includes(x))) return 'critical';
  if (['medium', 'средн', 'середн'].some((x) => v.includes(x))) return 'medium';
  return raw || 'medium';
}

function serializeAsset(a: {
  id: string;
  projectId: string;
  registrySystemId?: string;
  name: string;
  purpose: string;
  supportOwner: string;
  criticality: string;
  vendor: string;
  consumers: string;
  info: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    projectId: a.projectId,
    registrySystemId: a.registrySystemId || '',
    name: a.name,
    purpose: a.purpose,
    supportOwner: a.supportOwner,
    criticality: a.criticality,
    vendor: a.vendor,
    consumers: a.consumers,
    info: a.info,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function mapRegistryToAssetFields(reg: {
  id: string;
  name: string;
  purpose: string;
  supportOwner: string;
  appServers: string;
  dbServers: string;
  datacenter: string;
  techSpecs: string;
  criticality: string;
  vendor: string;
  consumers: string;
  info: string;
}) {
  const extra = [
    reg.appServers ? `App servers: ${reg.appServers}` : '',
    reg.dbServers ? `DB servers: ${reg.dbServers}` : '',
    reg.datacenter ? `Datacenter: ${reg.datacenter}` : '',
    reg.techSpecs ? `Tech specs: ${reg.techSpecs}` : '',
    reg.info || '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    registrySystemId: reg.id,
    name: reg.name.trim(),
    purpose: reg.purpose || '',
    supportOwner: reg.supportOwner || '',
    criticality: normalizeCriticality(reg.criticality || 'medium'),
    vendor: reg.vendor || '',
    consumers: reg.consumers || '',
    info: extra,
  };
}

async function assertProjectAccess(req: Request, prisma: PrismaClient, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: 404 as const, message: 'Project not found' };
  if (roleForCompany(req.user?.companies || {}, project.company) === null) {
    return { error: 403 as const, message: 'No access to this company' };
  }
  return { project };
}

function parseAssetEvidence(raw: string): Record<string, { evidence: string[]; evidenceLinks: string[] }> {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, { evidence: string[]; evidenceLinks: string[] }> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (!key) continue;
      const o = val && typeof val === 'object' ? (val as Record<string, unknown>) : {};
      out[key] = {
        evidence: Array.isArray(o.evidence) ? o.evidence.map(String).filter(Boolean) : [],
        evidenceLinks: Array.isArray(o.evidenceLinks) ? o.evidenceLinks.map(String).filter(Boolean) : [],
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function registerAssetRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/projects/:id/assets', async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const assets = await prisma.projectAsset.findMany({
        where: { projectId: req.params.id },
        orderBy: [{ criticality: 'desc' }, { name: 'asc' }],
      });
      res.json(assets.map(serializeAsset));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load assets' });
    }
  });

  app.post('/api/projects/:id/assets', requirePermission('projects:write', 'project-controls:write'), async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const project = access.project!;
      if (!accessHasPermission(req.user?.companies || {}, 'projects:write', project.company)
        && !accessHasPermission(req.user?.companies || {}, 'project-controls:write', project.company)) {
        return res.status(403).json({ error: 'No write access to this company' });
      }

      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Asset name is required' });

      const created = await prisma.projectAsset.create({
        data: {
          projectId: project.id,
          name,
          purpose: String(req.body?.purpose || ''),
          supportOwner: String(req.body?.supportOwner || ''),
          criticality: normalizeCriticality(String(req.body?.criticality || 'medium')),
          vendor: String(req.body?.vendor || ''),
          consumers: String(req.body?.consumers || ''),
          info: String(req.body?.info || ''),
        },
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'create',
        entityType: 'project',
        entityId: project.id,
        entityLabel: created.name,
        summary: `Added asset "${created.name}" to project "${project.title}"`,
        metadata: { assetId: created.id },
      });

      res.status(201).json(serializeAsset(created));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        return res.status(409).json({ error: 'An asset with this name already exists in the project' });
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  });

  app.get(
    '/api/projects/:id/assets/registry-options',
    requirePermission('projects:write', 'project-controls:write', 'systems-registry:link'),
    async (req, res) => {
      try {
        const access = await assertProjectAccess(req, prisma, req.params.id);
        if ('error' in access && access.error) {
          return res.status(access.error).json({ error: access.message });
        }
        const project = access.project!;
        if (!req.user || !canLinkRegistryToProject(req.user, project.company)) {
          return res.status(403).json({ error: 'No permission to view registry options for this project' });
        }
        const [allRegistry, linked] = await Promise.all([
          prisma.informationSystem.findMany({
            orderBy: [{ company: 'asc' }, { systemCode: 'asc' }],
          }),
          prisma.projectAsset.findMany({
            where: { projectId: project.id },
            select: { id: true, name: true, registrySystemId: true },
          }),
        ]);
        const registry = allRegistry;
        const linkedIds = new Set(linked.map((a) => a.registrySystemId).filter(Boolean));
        const linkedNames = new Set(linked.map((a) => a.name.toLowerCase()));
        res.json(
          registry.map((r) => ({
            id: r.id,
            company: r.company,
            systemCode: r.systemCode,
            name: r.name,
            purpose: r.purpose,
            supportOwner: r.supportOwner,
            criticality: r.criticality,
            alreadyInScope: linkedIds.has(r.id) || linkedNames.has(r.name.toLowerCase()),
          })),
        );
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to load registry options' });
      }
    },
  );

  app.post(
    '/api/projects/:id/assets/from-registry',
    requirePermission('projects:write', 'project-controls:write', 'systems-registry:link'),
    async (req, res) => {
      try {
        const access = await assertProjectAccess(req, prisma, req.params.id);
        if ('error' in access && access.error) {
          return res.status(access.error).json({ error: access.message });
        }
        const project = access.project!;
        if (!req.user || !canLinkRegistryToProject(req.user, project.company)) {
          return res.status(403).json({ error: 'No permission to link assets from registry' });
        }

        const ids = Array.isArray(req.body?.ids)
          ? (req.body.ids as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
          : [];
        if (!ids.length) {
          return res.status(400).json({ error: 'Select at least one registry system' });
        }

        const registryRows = await prisma.informationSystem.findMany({
          where: { id: { in: ids } },
        });
        if (!registryRows.length) {
          return res.status(404).json({ error: 'No matching registry systems' });
        }

        const existing = await prisma.projectAsset.findMany({
          where: { projectId: project.id },
          select: { id: true, name: true, registrySystemId: true },
        });
        const byRegistryId = new Map(
          existing.filter((a) => a.registrySystemId).map((a) => [a.registrySystemId, a]),
        );
        const byName = new Map(existing.map((a) => [a.name.toLowerCase(), a]));

        let created = 0;
        let skipped = 0;
        for (const reg of registryRows) {
          if (byRegistryId.has(reg.id) || byName.has(reg.name.toLowerCase())) {
            skipped += 1;
            continue;
          }
          const fields = mapRegistryToAssetFields(reg);
          await prisma.projectAsset.create({
            data: { projectId: project.id, ...fields },
          });
          created += 1;
        }

        const assets = await prisma.projectAsset.findMany({
          where: { projectId: project.id },
          orderBy: [{ criticality: 'desc' }, { name: 'asc' }],
        });

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'create',
          entityType: 'project',
          entityId: project.id,
          entityLabel: project.title,
          summary: `Added ${created} asset(s) from IS Registry to project "${project.title}"`,
          metadata: { created, skipped, registryIds: ids },
        });

        res.status(201).json({
          created,
          skipped,
          assets: assets.map(serializeAsset),
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add assets from registry' });
      }
    },
  );

  app.patch('/api/projects/:id/assets/:assetId', requirePermission('projects:write', 'project-controls:write'), async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const project = access.project!;
      const existing = await prisma.projectAsset.findFirst({
        where: { id: req.params.assetId, projectId: project.id },
      });
      if (!existing) return res.status(404).json({ error: 'Asset not found' });

      const data: Record<string, string> = {};
      for (const key of ASSET_FIELDS) {
        if (req.body?.[key] !== undefined) {
          data[key] = key === 'criticality'
            ? normalizeCriticality(String(req.body[key]))
            : String(req.body[key] ?? '');
        }
      }
      if (data.name !== undefined && !data.name.trim()) {
        return res.status(400).json({ error: 'Asset name is required' });
      }

      const updated = await prisma.projectAsset.update({
        where: { id: existing.id },
        data,
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'update',
        entityType: 'project',
        entityId: project.id,
        entityLabel: updated.name,
        summary: `Updated asset "${updated.name}" in project`,
        changes: computeChanges(
          existing as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>,
          [...ASSET_FIELDS],
        ),
      });

      res.json(serializeAsset(updated));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        return res.status(409).json({ error: 'An asset with this name already exists in the project' });
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });

  app.delete('/api/projects/:id/assets/:assetId', requirePermission('projects:write', 'project-controls:write'), async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const existing = await prisma.projectAsset.findFirst({
        where: { id: req.params.assetId, projectId: req.params.id },
      });
      if (!existing) return res.status(404).json({ error: 'Asset not found' });

      const controls = await prisma.projectControl.findMany({
        where: { projectId: req.params.id },
        select: { id: true, assetIds: true, assetEvidence: true },
      });
      for (const c of controls) {
        let ids: string[] = [];
        try {
          const parsed = JSON.parse(c.assetIds || '[]');
          ids = Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          ids = [];
        }
        if (!ids.includes(existing.id)) continue;
        const nextIds = ids.filter((id) => id !== existing.id);
        const ev = parseAssetEvidence(c.assetEvidence || '{}');
        delete ev[existing.id];
        await prisma.projectControl.update({
          where: { id: c.id },
          data: {
            assetIds: JSON.stringify(nextIds),
            assetEvidence: JSON.stringify(ev),
          },
        });
      }

      await prisma.projectAsset.delete({ where: { id: existing.id } });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'delete',
        severity: 'warning',
        entityType: 'project',
        entityId: req.params.id,
        entityLabel: existing.name,
        summary: `Deleted asset "${existing.name}" from project`,
      });

      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  });
}
