import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from './auth/middleware.js';
import {
  accessHasPermission,
  isCompanyName,
  roleForCompany,
} from './auth/permissions.js';
import { auditFromRequest, computeChanges } from './audit.js';
import { notifySystemUpdateAssigned, resolveUserEmail } from './email/notifications.js';
import {
  IS_PLACEMENTS,
  IS_SYSTEM_TYPE_KEYS,
  allocateSystemCode,
  backfillMissingSystemCodes,
  isValidSystemCode,
  normalizePlacement,
  normalizeSystemType,
  parseSystemCode,
} from './is-registry-codes.js';

const STRING_FIELDS = [
  'name',
  'purpose',
  'supportOwner',
  'appServers',
  'osContainer',
  'dbServers',
  'techSpecs',
  'datacenter',
  'failover',
  'security',
  'criticality',
  'equipment',
  'info',
  'vendor',
  'consumers',
] as const;

function serialize(row: {
  id: string;
  systemCode: string;
  systemType: string;
  placement: string;
  company: string;
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
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    systemCode: row.systemCode,
    systemType: row.systemType || 'app',
    placement: row.placement || '',
    company: row.company,
    name: row.name,
    purpose: row.purpose,
    supportOwner: row.supportOwner,
    appServers: row.appServers,
    osContainer: row.osContainer,
    dbServers: row.dbServers,
    techSpecs: row.techSpecs,
    datacenter: row.datacenter,
    failover: row.failover,
    security: row.security,
    criticality: row.criticality || 'medium',
    equipment: row.equipment,
    info: row.info,
    vendor: row.vendor,
    consumers: row.consumers,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function pickBody(body: Record<string, unknown>) {
  const data: Record<string, string> = {};
  for (const key of STRING_FIELDS) {
    if (body[key] !== undefined) data[key] = String(body[key] ?? '').trim();
  }
  if (body.company !== undefined) data.company = String(body.company ?? '').trim();
  if (body.systemType !== undefined) data.systemType = normalizeSystemType(String(body.systemType));
  if (body.placement !== undefined) data.placement = normalizePlacement(String(body.placement));
  if (body.systemCode !== undefined) data.systemCode = String(body.systemCode ?? '').trim().toLowerCase();
  if (data.criticality && !['low', 'medium', 'high', 'critical'].includes(data.criticality)) {
    data.criticality = 'medium';
  }
  if (data.placement && !IS_PLACEMENTS.includes(data.placement as typeof IS_PLACEMENTS[number])) {
    data.placement = '';
  }
  return data;
}

export function registerInformationSystemRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/information-systems/meta', requirePermission('systems-registry:read'), (_req, res) => {
    res.json({
      systemTypes: IS_SYSTEM_TYPE_KEYS,
      placements: IS_PLACEMENTS,
    });
  });

  app.get('/api/information-systems', requirePermission('systems-registry:read'), async (req, res) => {
    try {
      await backfillMissingSystemCodes(prisma);
      const rows = await prisma.informationSystem.findMany({
        orderBy: [{ systemCode: 'asc' }],
      });
      const allowed = req.user
        ? rows.filter(r => roleForCompany(req.user!.companies, r.company) !== null)
        : [];
      res.json(allowed.map(serialize));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load information systems' });
    }
  });

  app.get('/api/information-systems/:id', requirePermission('systems-registry:read'), async (req, res) => {
    try {
      const row = await prisma.informationSystem.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: 'Information system not found' });
      if (roleForCompany(req.user?.companies || {}, row.company) === null) {
        return res.status(403).json({ error: 'No access to this company' });
      }
      res.json(serialize(row));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load information system' });
    }
  });

  app.post('/api/information-systems', requirePermission('systems-registry:write'), async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const data = pickBody(body);
      const company = data.company || '';
      const name = data.name || '';
      if (!name) return res.status(400).json({ error: 'Name is required' });
      if (!isCompanyName(company)) return res.status(400).json({ error: 'Valid company is required' });
      if (!accessHasPermission(req.user?.companies || {}, 'systems-registry:write', company)) {
        return res.status(403).json({ error: 'No write access for this company' });
      }

      const systemType = normalizeSystemType(data.systemType || String(body.systemType || 'app'));
      let systemCode = data.systemCode || '';
      if (systemCode) {
        if (!isValidSystemCode(systemCode)) {
          return res.status(400).json({ error: 'System ID must match pattern: prefix-001 (e.g. infr-001)' });
        }
        const parsed = parseSystemCode(systemCode);
        if (parsed && parsed.prefix !== systemType) {
          return res.status(400).json({ error: 'System ID prefix must match system type' });
        }
        const taken = await prisma.informationSystem.findUnique({ where: { systemCode } });
        if (taken) return res.status(409).json({ error: 'System ID already exists' });
      } else {
        systemCode = await allocateSystemCode(prisma, systemType);
      }

      const created = await prisma.informationSystem.create({
        data: {
          systemCode,
          systemType,
          placement: data.placement || '',
          company,
          name,
          purpose: data.purpose || '',
          supportOwner: data.supportOwner || '',
          appServers: data.appServers || '',
          osContainer: data.osContainer || '',
          dbServers: data.dbServers || '',
          techSpecs: data.techSpecs || '',
          datacenter: data.datacenter || '',
          failover: data.failover || '',
          security: data.security || '',
          criticality: data.criticality || 'medium',
          equipment: data.equipment || '',
          info: data.info || '',
          vendor: data.vendor || '',
          consumers: data.consumers || '',
        },
      });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'create',
        entityType: 'information_system',
        entityId: created.id,
        entityLabel: `${created.systemCode} ${created.name}`,
        summary: `Created information system "${created.systemCode}" — ${created.name} (${created.company})`,
        changes: {
          systemCode: { from: null, to: created.systemCode },
          name: { from: null, to: created.name },
          company: { from: null, to: created.company },
        },
      });

      res.status(201).json(serialize(created));
    } catch (error: unknown) {
      console.error(error);
      const msg = String((error as { code?: string })?.code || '');
      if (msg === 'P2002') {
        return res.status(409).json({ error: 'A system with this name or ID already exists' });
      }
      res.status(500).json({ error: 'Failed to create information system' });
    }
  });

  app.patch('/api/information-systems/:id', requirePermission('systems-registry:write'), async (req, res) => {
    try {
      const existing = await prisma.informationSystem.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Information system not found' });
      if (!accessHasPermission(req.user?.companies || {}, 'systems-registry:write', existing.company)) {
        return res.status(403).json({ error: 'No write access for this company' });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const data = pickBody(body);
      if (data.company !== undefined) {
        if (!isCompanyName(data.company)) {
          return res.status(400).json({ error: 'Valid company is required' });
        }
        if (!accessHasPermission(req.user?.companies || {}, 'systems-registry:write', data.company)) {
          return res.status(403).json({ error: 'No write access for target company' });
        }
      }
      if (data.name !== undefined && !data.name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      // systemCode is immutable after creation
      delete data.systemCode;

      const updated = await prisma.informationSystem.update({
        where: { id: existing.id },
        data,
      });

      if (data.supportOwner !== undefined && data.supportOwner !== existing.supportOwner && updated.supportOwner) {
        const owner = await resolveUserEmail(prisma, updated.supportOwner);
        if (owner) {
          void notifySystemUpdateAssigned({
            prisma,
            toEmail: owner.email,
            toName: owner.name,
            systemName: updated.name,
            systemId: updated.id,
          }).catch((err) => console.error('[email] system update assignment failed', err));
        }
      }

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'update',
        entityType: 'information_system',
        entityId: updated.id,
        entityLabel: `${updated.systemCode} ${updated.name}`,
        summary: `Updated information system "${updated.systemCode}" — ${updated.name}`,
        changes: computeChanges(
          existing as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>,
          ['systemType', 'placement', 'company', ...STRING_FIELDS],
        ),
      });

      res.json(serialize(updated));
    } catch (error: unknown) {
      console.error(error);
      const msg = String((error as { code?: string })?.code || '');
      if (msg === 'P2002') {
        return res.status(409).json({ error: 'A system with this name already exists for the company' });
      }
      res.status(500).json({ error: 'Failed to update information system' });
    }
  });

  app.delete('/api/information-systems/:id', requirePermission('systems-registry:write'), async (req, res) => {
    try {
      const existing = await prisma.informationSystem.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Information system not found' });
      if (!accessHasPermission(req.user?.companies || {}, 'systems-registry:write', existing.company)) {
        return res.status(403).json({ error: 'No write access for this company' });
      }

      await prisma.informationSystem.delete({ where: { id: existing.id } });

      await auditFromRequest(prisma, req, {
        category: 'data',
        action: 'delete',
        severity: 'warning',
        entityType: 'information_system',
        entityId: existing.id,
        entityLabel: `${existing.systemCode} ${existing.name}`,
        summary: `Deleted information system "${existing.systemCode}" — ${existing.name}`,
        changes: { name: { from: existing.name, to: null } },
      });

      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete information system' });
    }
  });
}
