import type { Request } from 'express';
import type { PrismaClient } from '@prisma/client';

export type AuditCategory = 'security' | 'data';
export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'create'
  | 'update'
  | 'delete'
  | 'upload'
  | 'download'
  | 'approve'
  | 'review'
  | 'access_denied';

export type AuditEntityType =
  | 'session'
  | 'user'
  | 'control'
  | 'project'
  | 'project_control'
  | 'attachment'
  | string;

const REDACT_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'authorization',
]);

export interface AuditEventInput {
  category: AuditCategory;
  action: AuditAction | string;
  severity?: AuditSeverity;
  success?: boolean;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }> | Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export function clientMeta(req: Request): { ipAddress: string; userAgent: string } {
  const forwarded = req.headers['x-forwarded-for'];
  const fromHeader = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : '';
  return {
    ipAddress: fromHeader || req.socket.remoteAddress || '',
    userAgent: String(req.headers['user-agent'] || ''),
  };
}

export function actorFromRequest(req: Request): Pick<
  AuditEventInput,
  'actorId' | 'actorEmail' | 'actorName' | 'actorRole'
> {
  if (!req.user) return {};
  return {
    actorId: req.user.id,
    actorEmail: req.user.email,
    actorName: req.user.name,
    actorRole: req.user.role,
  };
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (REDACT_KEYS.has(key)) return '[REDACTED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && value.length > 2000) {
    return `${value.slice(0, 2000)}…`;
  }
  if (Array.isArray(value)) {
    return value.length > 50 ? [...value.slice(0, 50), `…(+${value.length - 50})`] : value;
  }
  if (typeof value === 'object') {
    try {
      const raw = JSON.stringify(value);
      if (raw.length > 4000) return `${raw.slice(0, 4000)}…`;
    } catch {
      return '[object]';
    }
  }
  return value;
}

/** Field-level before/after for audited updates. */
export function computeChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (!before && !after) return changes;
  const keys = fields?.length
    ? fields
    : [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];

  for (const key of keys) {
    if (REDACT_KEYS.has(key)) {
      const from = before?.[key];
      const to = after?.[key];
      if (from !== to) {
        changes[key] = { from: from ? '[REDACTED]' : from, to: to ? '[SET]' : to };
      }
      continue;
    }
    const from = before?.[key];
    const to = after?.[key];
    const fromNorm = normalizeComparable(from);
    const toNorm = normalizeComparable(to);
    if (fromNorm !== toNorm) {
      changes[key] = {
        from: sanitizeValue(key, from),
        to: sanitizeValue(key, to),
      };
    }
  }
  return changes;
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export async function writeAuditLog(
  prisma: PrismaClient,
  event: AuditEventInput,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        category: event.category,
        action: event.action,
        severity: event.severity || 'info',
        success: event.success !== false,
        actorId: event.actorId || '',
        actorEmail: event.actorEmail || '',
        actorName: event.actorName || '',
        actorRole: event.actorRole || '',
        entityType: event.entityType || '',
        entityId: event.entityId || '',
        entityLabel: event.entityLabel || '',
        summary: event.summary,
        changes: JSON.stringify(event.changes || {}),
        metadata: JSON.stringify(event.metadata || {}),
        ipAddress: event.ipAddress || '',
        userAgent: event.userAgent || '',
      },
    });
  } catch (error) {
    // Never fail the primary request because audit write failed
    console.error('[audit] failed to write log', error);
  }
}

export async function auditFromRequest(
  prisma: PrismaClient,
  req: Request,
  event: Omit<AuditEventInput, 'actorId' | 'actorEmail' | 'actorName' | 'actorRole' | 'ipAddress' | 'userAgent'> &
    Partial<Pick<AuditEventInput, 'actorId' | 'actorEmail' | 'actorName' | 'actorRole'>>,
): Promise<void> {
  const meta = clientMeta(req);
  const actor = actorFromRequest(req);
  await writeAuditLog(prisma, {
    ...actor,
    ...meta,
    ...event,
    actorId: event.actorId ?? actor.actorId,
    actorEmail: event.actorEmail ?? actor.actorEmail,
    actorName: event.actorName ?? actor.actorName,
    actorRole: event.actorRole ?? actor.actorRole,
  });
}

export function serializeAuditLog(row: {
  id: string;
  createdAt: Date;
  category: string;
  action: string;
  severity: string;
  success: boolean;
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  changes: string;
  metadata: string;
  ipAddress: string;
  userAgent: string;
}) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    category: row.category,
    action: row.action,
    severity: row.severity,
    success: row.success,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    actorName: row.actorName,
    actorRole: row.actorRole,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    summary: row.summary,
    changes: safeParseObject(row.changes),
    metadata: safeParseObject(row.metadata),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
  };
}

function safeParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
