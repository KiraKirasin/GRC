import type { PrismaClient } from '@prisma/client';

/** Prefix → system category in the IS Registry */
export const IS_SYSTEM_TYPES = {
  infr: 'Infrastructure / servers',
  app: 'Application',
  sec: 'Security',
  net: 'Network',
  db: 'Database',
  data: 'Data platform',
  mon: 'Monitoring',
  int: 'Integration',
} as const;

export type IsSystemType = keyof typeof IS_SYSTEM_TYPES;

export const IS_SYSTEM_TYPE_KEYS = Object.keys(IS_SYSTEM_TYPES) as IsSystemType[];

export const IS_PLACEMENTS = ['cloud', 'datacenter', 'on_prem', 'hybrid'] as const;
export type IsPlacement = (typeof IS_PLACEMENTS)[number];

const SYSTEM_CODE_RE = /^([a-z]{2,5})-(\d{3,})$/;

export function normalizeSystemType(raw: string): IsSystemType {
  const v = String(raw || '').toLowerCase().trim();
  if (v in IS_SYSTEM_TYPES) return v as IsSystemType;
  if (v === 'infra' || v === 'infrastructure' || v === 'server' || v === 'servers') return 'infr';
  if (v === 'application' || v === 'applications') return 'app';
  if (v === 'security') return 'sec';
  if (v === 'network' || v === 'networking') return 'net';
  if (v === 'database' || v === 'databases') return 'db';
  return 'app';
}

export function normalizePlacement(raw: string): IsPlacement | '' {
  const v = String(raw || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (v === 'on-prem' || v === 'onprem' || v === 'on_premises' || v === 'prem') return 'on_prem';
  if (v === 'dc' || v === 'datacenter' || v === 'data_center' || v === 'цод') return 'datacenter';
  if (v === 'cloud' || v === 'хмara' || v === 'хмара') return 'cloud';
  if (IS_PLACEMENTS.includes(v as IsPlacement)) return v as IsPlacement;
  return '';
}

export function isValidSystemCode(code: string): boolean {
  return SYSTEM_CODE_RE.test(String(code || '').trim());
}

export function parseSystemCode(code: string): { prefix: IsSystemType; number: number } | null {
  const m = String(code || '').trim().match(SYSTEM_CODE_RE);
  if (!m) return null;
  const prefix = normalizeSystemType(m[1]);
  return { prefix, number: parseInt(m[2], 10) };
}

/** Allocate next code for prefix, e.g. infr-007 */
export async function allocateSystemCode(prisma: PrismaClient, systemType: string): Promise<string> {
  const prefix = normalizeSystemType(systemType);
  const rows = await prisma.informationSystem.findMany({
    where: { systemCode: { startsWith: `${prefix}-` } },
    select: { systemCode: true },
  });
  let max = 0;
  for (const row of rows) {
    const parsed = parseSystemCode(row.systemCode);
    if (parsed?.prefix === prefix) max = Math.max(max, parsed.number);
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function inferSystemTypeFromName(name: string): IsSystemType {
  const n = String(name || '').toLowerCase();
  if (/zabbix|monitor|монітор|grafana|prometheus|nagios|observ/.test(n)) return 'mon';
  if (/firewall|антивірус|antivirus|waf|security|безпек|захист|сканування|fortinet|palo/.test(n)) return 'sec';
  if (/мереж|network|dhcp|switch|router|cisco|периметр|wifi|vlan|\bdns\b|anyconnect/.test(n)) return 'net';
  if (/\bsql\b|субд|database|oracle|postgres|mysql|dwh|сховище даних|data warehouse|\bdb\b/.test(n)) return 'db';
  if (/gitlab|jenkins|kafka|rabbit|integration|інтегра|etl|api gateway/.test(n)) return 'int';
  if (/analytics|bi\b|data lake|dataplatform/.test(n)) return 'data';
  if (/vmware|veeam|virtual|backup|резерв|hypervisor|windows server|\bсервер/.test(n)) return 'infr';
  return 'app';
}

/** One-time backfill for rows missing systemCode */
export async function backfillMissingSystemCodes(prisma: PrismaClient): Promise<number> {
  const missing = await prisma.informationSystem.findMany({
    where: { OR: [{ systemCode: '' }, { systemCode: { startsWith: 'legacy-' } }] },
    orderBy: { createdAt: 'asc' },
  });
  for (const row of missing) {
    const systemType = inferSystemTypeFromName(row.name);
    const systemCode = await allocateSystemCode(prisma, systemType);
    await prisma.informationSystem.update({
      where: { id: row.id },
      data: { systemCode, systemType },
    });
  }
  return missing.length;
}
