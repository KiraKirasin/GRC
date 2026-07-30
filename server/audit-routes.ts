import type { Express, Request } from 'express';
import type { PrismaClient, Prisma } from '@prisma/client';
import { requirePermission } from './auth/middleware.js';
import { serializeAuditLog } from './audit.js';

function parseLimit(raw: unknown, fallback = 100, max = 500): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function registerAuditRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/audit-logs', requirePermission('audit:read'), async (req, res) => {
    try {
      const where = buildWhere(req);
      const limit = parseLimit(req.query.limit);
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const [total, rows] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
      ]);

      res.json({
        total,
        limit,
        offset,
        items: rows.map(serializeAuditLog),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load audit logs' });
    }
  });

  app.get('/api/audit-logs/meta', requirePermission('audit:read'), async (_req, res) => {
    try {
      const [actions, entityTypes, actors] = await Promise.all([
        prisma.auditLog.findMany({
          distinct: ['action'],
          select: { action: true },
          orderBy: { action: 'asc' },
        }),
        prisma.auditLog.findMany({
          distinct: ['entityType'],
          select: { entityType: true },
          orderBy: { entityType: 'asc' },
        }),
        prisma.auditLog.findMany({
          where: { actorEmail: { not: '' } },
          distinct: ['actorEmail'],
          select: { actorEmail: true, actorName: true },
          orderBy: { actorEmail: 'asc' },
          take: 200,
        }),
      ]);

      res.json({
        actions: actions.map(a => a.action).filter(Boolean),
        entityTypes: entityTypes.map(e => e.entityType).filter(Boolean),
        actors: actors.map(a => ({ email: a.actorEmail, name: a.actorName })),
        categories: ['security', 'data'],
        severities: ['info', 'warning', 'critical'],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load audit meta' });
    }
  });
}

function buildWhere(req: Request): Prisma.AuditLogWhereInput {
  const q = req.query;
  const where: Prisma.AuditLogWhereInput = {};

  if (typeof q.category === 'string' && q.category) where.category = q.category;
  if (typeof q.action === 'string' && q.action) where.action = q.action;
  if (typeof q.severity === 'string' && q.severity) where.severity = q.severity;
  if (typeof q.entityType === 'string' && q.entityType) where.entityType = q.entityType;
  if (typeof q.entityId === 'string' && q.entityId) where.entityId = q.entityId;
  if (typeof q.actorId === 'string' && q.actorId) where.actorId = q.actorId;
  if (typeof q.actorEmail === 'string' && q.actorEmail) where.actorEmail = q.actorEmail;
  if (q.success === 'true') where.success = true;
  if (q.success === 'false') where.success = false;

  if (typeof q.from === 'string' && q.from) {
    const from = new Date(q.from);
    if (!Number.isNaN(from.getTime())) {
      where.createdAt = { ...(where.createdAt as object), gte: from };
    }
  }
  if (typeof q.to === 'string' && q.to) {
    const to = new Date(q.to);
    if (!Number.isNaN(to.getTime())) {
      where.createdAt = { ...(where.createdAt as object), lte: to };
    }
  }

  if (typeof q.search === 'string' && q.search.trim()) {
    const s = q.search.trim();
    where.OR = [
      { summary: { contains: s } },
      { entityLabel: { contains: s } },
      { actorName: { contains: s } },
      { actorEmail: { contains: s } },
      { entityId: { contains: s } },
      { ipAddress: { contains: s } },
    ];
  }

  return where;
}
