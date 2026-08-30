import type { Express, Request } from 'express';
import type { PrismaClient } from '@prisma/client';
import multer from 'multer';
import XLSX from 'xlsx';
import { requirePermission } from './auth/middleware.js';
import { accessHasPermission, canLinkRegistryToProject, roleForCompany } from './auth/permissions.js';
import { auditFromRequest, computeChanges } from './audit.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const SYSTEM_FIELDS = [
  'name',
  'purpose',
  'owner',
  'serverLocation',
  'techSpecs',
  'os',
  'failover',
  'security',
  'criticality',
  'equipment',
  'info',
] as const;

type SystemField = (typeof SYSTEM_FIELDS)[number];

const HEADER_ALIASES: Record<SystemField, string[]> = {
  name: [
    'name',
    'название',
    'название и имя системы',
    'название системы',
    'имя системы',
    'system',
    'system name',
  ],
  purpose: ['purpose', 'назначение', 'назначение системы'],
  owner: ['owner', 'ответственный', 'responsible'],
  serverLocation: [
    'serverlocation',
    'расположение на сервере',
    'расположение на сервер',
    'расположение',
    'location',
    'server',
  ],
  techSpecs: [
    'techspecs',
    'технические характеристики',
    'характеристики',
    'specs',
  ],
  os: ['os', 'ос', 'operating system'],
  failover: ['failover', 'отказоустойчивость'],
  security: ['security', 'безопасность'],
  criticality: ['criticality', 'критичность', 'critical'],
  equipment: ['equipment', 'оборудование'],
  info: ['info', 'информация', 'information', 'notes', 'примечание'],
};

function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .replace(/[:：]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapHeaders(headers: string[]): Partial<Record<SystemField, number>> {
  const map: Partial<Record<SystemField, number>> = {};
  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    for (const field of SYSTEM_FIELDS) {
      if (map[field] !== undefined) continue;
      if (HEADER_ALIASES[field].some((a) => a === norm || norm.includes(a))) {
        map[field] = idx;
      }
    }
  });
  return map;
}

function cell(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return '';
  const v = row[idx];
  if (v == null) return '';
  return String(v).replace(/\r\n/g, '\n').trim();
}

function normalizeCriticality(raw: string): string {
  const v = raw.toLowerCase();
  if (['low', 'низк', 'низкая', 'низький'].some((x) => v.includes(x))) return 'low';
  if (['high', 'высок', 'високий', 'высокая'].some((x) => v.includes(x))) return 'high';
  if (['critical', 'критич'].some((x) => v.includes(x))) return 'critical';
  if (['medium', 'средн', 'середн'].some((x) => v.includes(x))) return 'medium';
  return raw || 'medium';
}

function serializeSystem(s: {
  id: string;
  projectId: string;
  registrySystemId?: string;
  name: string;
  purpose: string;
  owner: string;
  serverLocation: string;
  techSpecs: string;
  os: string;
  failover: string;
  security: string;
  criticality: string;
  equipment: string;
  info: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    projectId: s.projectId,
    registrySystemId: s.registrySystemId || '',
    name: s.name,
    purpose: s.purpose,
    owner: s.owner,
    serverLocation: s.serverLocation,
    techSpecs: s.techSpecs,
    os: s.os,
    failover: s.failover,
    security: s.security,
    criticality: s.criticality,
    equipment: s.equipment,
    info: s.info,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function mapRegistryToProjectFields(reg: {
  id: string;
  name: string;
  purpose: string;
  supportOwner: string;
  appServers: string;
  osContainer: string;
  dbServers: string;
  techSpecs: string;
  datacenter: string;
  failover: string;
  security: string;
  criticality: string;
  equipment: string;
  info: string;
  vendor: string;
  consumers: string;
}) {
  const extra = [
    reg.dbServers ? `DB servers: ${reg.dbServers}` : '',
    reg.datacenter ? `Datacenter: ${reg.datacenter}` : '',
    reg.vendor ? `Vendor: ${reg.vendor}` : '',
    reg.consumers ? `Consumers: ${reg.consumers}` : '',
    reg.info || '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    registrySystemId: reg.id,
    name: reg.name.trim(),
    purpose: reg.purpose || '',
    owner: reg.supportOwner || '',
    serverLocation: reg.appServers || '',
    techSpecs: reg.techSpecs || '',
    os: reg.osContainer || '',
    failover: reg.failover || '',
    security: reg.security || '',
    criticality: normalizeCriticality(reg.criticality || 'medium'),
    equipment: reg.equipment || '',
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

export function registerSystemRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/projects/:id/systems', async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const systems = await prisma.projectSystem.findMany({
        where: { projectId: req.params.id },
        orderBy: [{ criticality: 'desc' }, { name: 'asc' }],
      });
      res.json(systems.map(serializeSystem));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load systems' });
    }
  });

  app.post('/api/projects/:id/systems', requirePermission('projects:write', 'project-controls:write'), async (req, res) => {
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
      if (!name) return res.status(400).json({ error: 'System name is required' });

      const created = await prisma.projectSystem.create({
        data: {
          projectId: project.id,
          name,
          purpose: String(req.body?.purpose || ''),
          owner: String(req.body?.owner || ''),
          serverLocation: String(req.body?.serverLocation || ''),
          techSpecs: String(req.body?.techSpecs || ''),
          os: String(req.body?.os || ''),
          failover: String(req.body?.failover || ''),
          security: String(req.body?.security || ''),
          criticality: normalizeCriticality(String(req.body?.criticality || 'medium')),
          equipment: String(req.body?.equipment || ''),
          info: String(req.body?.info || ''),
        },
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'create',
        entityType: 'project',
        entityId: project.id,
        entityLabel: created.name,
        summary: `Added system "${created.name}" to project "${project.title}"`,
        metadata: { systemId: created.id },
      });

      res.status(201).json(serializeSystem(created));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        return res.status(409).json({ error: 'A system with this name already exists in the project' });
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to create system' });
    }
  });

  /** List company IS Registry entries available to add into this project scope */
  app.get(
    '/api/projects/:id/systems/registry-options',
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
          prisma.projectSystem.findMany({
            where: { projectId: project.id },
            select: { id: true, name: true, registrySystemId: true },
          }),
        ]);
        const registry = allRegistry;
        const linkedIds = new Set(
          linked.map((s) => s.registrySystemId).filter(Boolean),
        );
        const linkedNames = new Set(linked.map((s) => s.name.toLowerCase()));
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

  /** Copy selected IS Registry systems into project scope */
  app.post(
    '/api/projects/:id/systems/from-registry',
    requirePermission('projects:write', 'project-controls:write', 'systems-registry:link'),
    async (req, res) => {
      try {
        const access = await assertProjectAccess(req, prisma, req.params.id);
        if ('error' in access && access.error) {
          return res.status(access.error).json({ error: access.message });
        }
        const project = access.project!;
        if (!req.user || !canLinkRegistryToProject(req.user, project.company)) {
          return res.status(403).json({ error: 'No permission to link systems from registry' });
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

        const existing = await prisma.projectSystem.findMany({
          where: { projectId: project.id },
          select: { id: true, name: true, registrySystemId: true },
        });
        const byRegistryId = new Map(
          existing.filter((s) => s.registrySystemId).map((s) => [s.registrySystemId, s]),
        );
        const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));

        let created = 0;
        let skipped = 0;
        const addedIds: string[] = [];

        for (const reg of registryRows) {
          if (byRegistryId.has(reg.id) || byName.has(reg.name.toLowerCase())) {
            skipped += 1;
            continue;
          }
          const fields = mapRegistryToProjectFields(reg);
          const row = await prisma.projectSystem.create({
            data: {
              projectId: project.id,
              ...fields,
            },
          });
          created += 1;
          addedIds.push(row.id);
          byRegistryId.set(reg.id, row);
          byName.set(row.name.toLowerCase(), row);
        }

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'create',
          entityType: 'project',
          entityId: project.id,
          entityLabel: project.title,
          summary: `Added ${created} system(s) from IS Registry to project "${project.title}"`,
          metadata: { created, skipped, registryIds: registryRows.map((r) => r.id), addedIds },
        });

        const systems = await prisma.projectSystem.findMany({
          where: { projectId: project.id },
          orderBy: [{ criticality: 'desc' }, { name: 'asc' }],
        });
        res.status(201).json({ created, skipped, systems: systems.map(serializeSystem) });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add systems from registry' });
      }
    },
  );

  app.patch('/api/projects/:id/systems/:systemId', requirePermission('projects:write', 'project-controls:write'), async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const existing = await prisma.projectSystem.findFirst({
        where: { id: req.params.systemId, projectId: req.params.id },
      });
      if (!existing) return res.status(404).json({ error: 'System not found' });

      const data: Record<string, string> = {};
      for (const key of SYSTEM_FIELDS) {
        if (req.body?.[key] !== undefined) {
          data[key] = key === 'criticality'
            ? normalizeCriticality(String(req.body[key]))
            : String(req.body[key]);
        }
      }
      if (data.name !== undefined && !data.name.trim()) {
        return res.status(400).json({ error: 'System name is required' });
      }

      const updated = await prisma.projectSystem.update({
        where: { id: existing.id },
        data,
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'update',
        entityType: 'project',
        entityId: req.params.id,
        entityLabel: updated.name,
        summary: `Updated system "${updated.name}"`,
        changes: computeChanges(
          existing as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>,
          [...SYSTEM_FIELDS],
        ),
      });

      res.json(serializeSystem(updated));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        return res.status(409).json({ error: 'A system with this name already exists in the project' });
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to update system' });
    }
  });

  app.delete('/api/projects/:id/systems/:systemId', requirePermission('projects:write'), async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const existing = await prisma.projectSystem.findFirst({
        where: { id: req.params.systemId, projectId: req.params.id },
      });
      if (!existing) return res.status(404).json({ error: 'System not found' });

      // Remove system id from controls that reference it
      const controls = await prisma.projectControl.findMany({
        where: { projectId: req.params.id },
        select: { id: true, systemIds: true },
      });
      for (const c of controls) {
        let ids: string[] = [];
        try {
          const parsed = JSON.parse(c.systemIds || '[]');
          ids = Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          ids = [];
        }
        if (!ids.includes(existing.id)) continue;
        const next = ids.filter((id) => id !== existing.id);
        await prisma.projectControl.update({
          where: { id: c.id },
          data: { systemIds: JSON.stringify(next) },
        });
      }

      await prisma.projectSystem.delete({ where: { id: existing.id } });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'delete',
        severity: 'warning',
        entityType: 'project',
        entityId: req.params.id,
        entityLabel: existing.name,
        summary: `Deleted system "${existing.name}" from project`,
      });

      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete system' });
    }
  });

  /** Download CSV template with Russian/English headers. */
  app.get('/api/projects/:id/systems/template', async (req, res) => {
    try {
      const access = await assertProjectAccess(req, prisma, req.params.id);
      if ('error' in access && access.error) {
        return res.status(access.error).json({ error: access.message });
      }
      const headers = [
        'Название и имя системы',
        'Назначение',
        'Ответственный',
        'Расположение на сервере',
        'Технические характеристики',
        'ОС',
        'Отказоустойчивость',
        'Безопасность',
        'Критичность',
        'Оборудование',
        'Информация',
      ];
      const example = [
        'Core Banking',
        'Основная АБС',
        'Иванов И.И.',
        'DC1 / srv-cbs-01',
        '8 vCPU, 32GB RAM',
        'Linux RHEL 8',
        'Active-Passive',
        'MFA, WAF',
        'critical',
        'Dell R740',
        'Prod',
      ];
      const csv = `${headers.join(';')}\n${example.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')}\n`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="systems-template.csv"');
      res.send('\uFEFF' + csv);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to build template' });
    }
  });

  app.post(
    '/api/projects/:id/systems/import',
    requirePermission('projects:write', 'project-controls:write'),
    upload.single('file'),
    async (req, res) => {
      try {
        const access = await assertProjectAccess(req, prisma, req.params.id);
        if ('error' in access && access.error) {
          return res.status(access.error).json({ error: access.message });
        }
        const project = access.project!;
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'file is required' });

        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) return res.status(400).json({ error: 'Workbook has no sheets' });

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (rows.length < 2) {
          return res.status(400).json({ error: 'File must contain a header row and at least one data row' });
        }

        const headerRow = (rows[0] || []).map((h) => String(h));
        const colMap = mapHeaders(headerRow);
        if (colMap.name === undefined) {
          return res.status(400).json({
            error: 'Missing required column: Название и имя системы (name)',
          });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          const name = cell(row, colMap.name);
          if (!name) {
            skipped += 1;
            continue;
          }
          const payload = {
            purpose: cell(row, colMap.purpose),
            owner: cell(row, colMap.owner),
            serverLocation: cell(row, colMap.serverLocation),
            techSpecs: cell(row, colMap.techSpecs),
            os: cell(row, colMap.os),
            failover: cell(row, colMap.failover),
            security: cell(row, colMap.security),
            criticality: normalizeCriticality(cell(row, colMap.criticality) || 'medium'),
            equipment: cell(row, colMap.equipment),
            info: cell(row, colMap.info),
          };

          try {
            const existing = await prisma.projectSystem.findFirst({
              where: { projectId: project.id, name },
            });
            if (existing) {
              await prisma.projectSystem.update({
                where: { id: existing.id },
                data: payload,
              });
              updated += 1;
            } else {
              await prisma.projectSystem.create({
                data: { projectId: project.id, name, ...payload },
              });
              created += 1;
            }
          } catch (e) {
            errors.push(`Row ${i + 1} (${name}): ${e instanceof Error ? e.message : 'failed'}`);
          }
        }

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'upload',
          entityType: 'project',
          entityId: project.id,
          entityLabel: project.title,
          summary: `Imported systems into "${project.title}" (created ${created}, updated ${updated})`,
          metadata: { created, updated, skipped, errors: errors.slice(0, 10) },
        });

        const systems = await prisma.projectSystem.findMany({
          where: { projectId: project.id },
          orderBy: [{ name: 'asc' }],
        });

        res.json({
          created,
          updated,
          skipped,
          errors,
          systems: systems.map(serializeSystem),
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to import systems' });
      }
    },
  );
}
