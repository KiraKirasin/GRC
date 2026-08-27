import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import multer from 'multer';
import XLSX from 'xlsx';
import { requirePermission } from './auth/middleware.js';
import { COMPANIES, isCompanyName } from './auth/permissions.js';
import { auditFromRequest } from './audit.js';
import {
  allocateSystemCode,
  isValidSystemCode,
  normalizePlacement,
  normalizeSystemType,
  parseSystemCode,
} from './is-registry-codes.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .replace(/[:：]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cell(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return '';
  const v = row[idx];
  if (v == null) return '';
  return String(v).replace(/\r\n/g, '\n').trim();
}

function mapColumns(headers: string[], aliases: Record<string, string[]>): Partial<Record<string, number>> {
  const map: Partial<Record<string, number>> = {};
  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    for (const [field, list] of Object.entries(aliases)) {
      if (map[field] !== undefined) continue;
      if (list.some((a) => a === norm || norm.includes(a))) {
        map[field] = idx;
      }
    }
  });
  return map;
}

function normalizeCriticality(raw: string): string {
  const v = raw.toLowerCase();
  if (['low', 'низк', 'низький', 'низкая'].some((x) => v.includes(x))) return 'low';
  if (['high', 'высок', 'високий', 'высокая'].some((x) => v.includes(x))) return 'high';
  if (['critical', 'критич'].some((x) => v.includes(x))) return 'critical';
  if (['medium', 'средн', 'середн'].some((x) => v.includes(x))) return 'medium';
  return raw || 'medium';
}

function normalizeControlStatus(raw: string): string {
  const v = raw.toLowerCase();
  if (['implemented', 'pass', 'mostly pass', 'впровадж', 'внедр'].some((x) => v.includes(x))) {
    return 'implemented';
  }
  if (['in_progress', 'in progress', 'partial', 'weak', 'в роботі', 'в работе'].some((x) => v.includes(x))) {
    return 'in_progress';
  }
  if (['not_applicable', 'n/a', 'na', 'н/п'].some((x) => v.includes(x))) {
    return 'not_applicable';
  }
  if (['pending', 'очікує', 'ожида'].some((x) => v.includes(x))) return 'pending';
  return raw || 'pending';
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
}

const CONTROL_ALIASES: Record<string, string[]> = {
  controlCode: ['control code', 'control id', 'код', 'код контролю', 'id'],
  title: ['title', 'control title', 'назва', 'название', 'название контроля'],
  description: ['description', 'statement', 'control statement', 'опис', 'описание'],
  framework: ['framework', 'фреймворк', 'стандарт'],
  category: ['category', 'domain', 'категорія', 'категория', 'домен'],
  status: ['status', 'статус'],
  owner: ['owner', 'control owner', 'власник', 'владелец'],
  controlDesign: ['control design', 'design', 'дизайн'],
  source: ['source', 'джерело', 'источник'],
  lastReviewed: ['last reviewed', 'last assessment', 'остання перевірка', 'последняя проверка'],
  evidence: ['evidence', 'expected evidence', 'докази', 'доказательства'],
  evidenceLinks: ['evidence link', 'evidence links', 'посилання', 'ссылки'],
};

const IS_ALIASES: Record<string, string[]> = {
  company: ['company', 'компанія', 'компания'],
  systemCode: ['system code', 'system id', 'id', 'код системи', 'код', 'systemcode'],
  systemType: ['system type', 'type', 'тип системи', 'тип', 'prefix', 'префікс'],
  placement: ['placement', 'hosting', 'розміщення', 'размещение', 'location type'],
  name: [
    'name',
    'system name',
    'название и имя системы',
    'назва та імʼя системи',
    'назва системи',
    'название системы',
  ],
  purpose: ['purpose', 'назначение', 'призначення'],
  supportOwner: [
    'support owner',
    'owner',
    'відповідальний за супровід',
    'ответственный за сопровождение',
    'ответственный',
  ],
  appServers: [
    'app servers',
    'application servers',
    'назви / ip-адреси серверів застосунків',
    'названия / ip-адреса серверов приложений',
    'сервери застосунків',
  ],
  osContainer: [
    'os',
    'container',
    'os / container',
    'расположение на сервере',
    'розташування на сервері',
  ],
  dbServers: [
    'db servers',
    'database servers',
    'назви / ip-адреси серверів бд',
    'названия / ip-адреса серверов бд',
  ],
  techSpecs: ['tech specs', 'technical', 'технічні характеристики', 'технические характеристики'],
  datacenter: ['datacenter', 'цод', 'фізичне розміщення', 'физическое размещение'],
  failover: ['failover', 'відмовостійкість', 'отказоустойчивость'],
  security: ['security', 'безпека', 'безопасность'],
  criticality: ['criticality', 'критичність', 'критичность'],
  equipment: ['equipment', 'обладнання', 'оборудование'],
  info: ['info', 'information', 'інформація', 'информация', 'notes'],
  vendor: ['vendor', 'developer', 'розробник', 'разработчик', 'виробник', 'производитель'],
  consumers: [
    'consumers',
    'user',
    'користувач',
    'пользователь',
    'департамент',
    'клиент',
    'клієнт',
  ],
};

export function registerAdminImportRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/admin/import/controls/template', requirePermission('users:manage', 'controls:write'), (_req, res) => {
    const headers = [
      'Control Code',
      'Title',
      'Description',
      'Framework',
      'Category',
      'Status',
      'Owner',
      'Control Design',
      'Source',
      'Last Reviewed',
      'Evidence',
      'Evidence Links',
    ];
    const sample = [
      'CTRL-001',
      'Access control policy',
      'Define and enforce RBAC',
      'ISO 27001',
      'Access Control',
      'pending',
      'owner@novapay.ua',
      'Objective: …',
      'ISO A.5.15',
      '2026-01-15',
      'Policy.pdf',
      'https://example.com/evidence',
    ];
    const csv = toCsv(headers, [sample]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="controls-import-template.csv"');
    res.send('\uFEFF' + csv);
  });

  app.post(
    '/api/admin/import/controls',
    requirePermission('users:manage', 'controls:write'),
    upload.single('file'),
    async (req, res) => {
      try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'file is required' });
        const defaultFramework = String(req.body?.framework || '').trim();

        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) return res.status(400).json({ error: 'Workbook has no sheets' });

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (rows.length < 2) {
          return res.status(400).json({ error: 'File must contain a header row and at least one data row' });
        }

        const colMap = mapColumns((rows[0] || []).map(String), CONTROL_ALIASES);
        if (colMap.title === undefined) {
          return res.status(400).json({ error: 'Missing required column: Title / Назва' });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          const title = cell(row, colMap.title);
          if (!title) {
            skipped += 1;
            continue;
          }
          const controlCode = cell(row, colMap.controlCode);
          const framework = cell(row, colMap.framework) || defaultFramework;
          const evidenceRaw = cell(row, colMap.evidence);
          const linksRaw = cell(row, colMap.evidenceLinks);
          const evidence = evidenceRaw
            ? evidenceRaw.split(/[;|]/).map((s) => s.trim()).filter(Boolean)
            : [];
          const evidenceLinks = linksRaw
            ? linksRaw.split(/[;|]/).map((s) => s.trim()).filter(Boolean)
            : [];
          const payload = {
            controlCode,
            title,
            description: cell(row, colMap.description),
            framework,
            category: cell(row, colMap.category),
            status: normalizeControlStatus(cell(row, colMap.status) || 'pending'),
            owner: cell(row, colMap.owner),
            controlDesign: cell(row, colMap.controlDesign),
            source: cell(row, colMap.source),
            lastReviewed: cell(row, colMap.lastReviewed),
            evidence: JSON.stringify(evidence),
            evidenceLinks: JSON.stringify(evidenceLinks),
          };

          try {
            let existing = controlCode
              ? await prisma.gRCControl.findUnique({ where: { controlCode } })
              : null;
            if (!existing && !controlCode) {
              existing = await prisma.gRCControl.findFirst({
                where: { title, framework },
              });
            }

            if (existing) {
              await prisma.gRCControl.update({
                where: { id: existing.id },
                data: {
                  ...payload,
                  // Keep unique constraint: empty code stays as existing code if blank in file
                  controlCode: controlCode || existing.controlCode,
                },
              });
              updated += 1;
            } else {
              // Avoid multiple empty unique controlCode collisions
              const code =
                controlCode ||
                `IMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
              await prisma.gRCControl.create({
                data: {
                  ...payload,
                  controlCode: code,
                  attachments: '[]',
                  accessList: '[]',
                },
              });
              created += 1;
            }
          } catch (err) {
            errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'create',
          entityType: 'control',
          entityId: '',
          entityLabel: 'controls import',
          summary: `Imported controls: created ${created}, updated ${updated}, skipped ${skipped}`,
          metadata: { created, updated, skipped, errors: errors.slice(0, 20) },
        });

        res.json({ created, updated, skipped, errors: errors.slice(0, 50) });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to import controls' });
      }
    },
  );

  app.get(
    '/api/admin/import/information-systems/template',
    requirePermission('users:manage', 'systems-registry:write'),
    (_req, res) => {
      const headers = [
        'System ID',
        'System Type',
        'Company',
        'Name',
        'Purpose',
        'Support Owner',
        'Vendor',
        'Placement',
        'Criticality',
        'App Servers',
        'OS / Container',
        'DB Servers',
        'Tech Specs',
        'Datacenter',
        'Failover',
        'Security',
        'Equipment',
        'Info',
        'Consumers',
      ];
      const sample = [
        '',
        'infr',
        COMPANIES[0],
        'CRM Core',
        'Customer operations',
        'ops@novapay.ua',
        'Vendor Ltd',
        'cloud',
        'high',
        'app1.local / 10.0.0.11',
        'Linux / Docker',
        'db1.local / 10.0.0.21',
        '8 vCPU / 32GB',
        'DC Kyiv',
        'Active-Passive',
        'WAF + MFA',
        'Dell R740',
        'Notes',
        'NovaPay Ops / Retail',
      ];
      const csv = toCsv(headers, [sample]);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="is-registry-import-template.csv"');
      res.send('\uFEFF' + csv);
    },
  );

  app.post(
    '/api/admin/import/information-systems',
    requirePermission('users:manage', 'systems-registry:write'),
    upload.single('file'),
    async (req, res) => {
      try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'file is required' });
        const defaultCompany = String(req.body?.company || '').trim();
        if (defaultCompany && !isCompanyName(defaultCompany)) {
          return res.status(400).json({ error: 'Invalid default company' });
        }

        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) return res.status(400).json({ error: 'Workbook has no sheets' });

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (rows.length < 2) {
          return res.status(400).json({ error: 'File must contain a header row and at least one data row' });
        }

        const colMap = mapColumns((rows[0] || []).map(String), IS_ALIASES);
        if (colMap.name === undefined) {
          return res.status(400).json({ error: 'Missing required column: Name / Назва системи' });
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
          const companyRaw = cell(row, colMap.company) || defaultCompany;
          if (!isCompanyName(companyRaw)) {
            errors.push(`Row ${i + 1}: invalid or missing company`);
            skipped += 1;
            continue;
          }

          const payload = {
            purpose: cell(row, colMap.purpose),
            supportOwner: cell(row, colMap.supportOwner),
            appServers: cell(row, colMap.appServers),
            osContainer: cell(row, colMap.osContainer),
            dbServers: cell(row, colMap.dbServers),
            techSpecs: cell(row, colMap.techSpecs),
            datacenter: cell(row, colMap.datacenter),
            failover: cell(row, colMap.failover),
            security: cell(row, colMap.security),
            criticality: normalizeCriticality(cell(row, colMap.criticality) || 'medium'),
            equipment: cell(row, colMap.equipment),
            info: cell(row, colMap.info),
            vendor: cell(row, colMap.vendor),
            consumers: cell(row, colMap.consumers),
            placement: normalizePlacement(cell(row, colMap.placement)),
          };
          const systemType = normalizeSystemType(cell(row, colMap.systemType) || 'app');
          let systemCode = cell(row, colMap.systemCode).toLowerCase();

          try {
            const existing = await prisma.informationSystem.findUnique({
              where: { company_name: { company: companyRaw, name } },
            });
            if (existing) {
              await prisma.informationSystem.update({
                where: { id: existing.id },
                data: { ...payload, systemType },
              });
              updated += 1;
            } else {
              if (systemCode) {
                if (!isValidSystemCode(systemCode)) {
                  errors.push(`Row ${i + 1}: invalid System ID format (use prefix-001)`);
                  skipped += 1;
                  continue;
                }
                const taken = await prisma.informationSystem.findUnique({ where: { systemCode } });
                if (taken) {
                  errors.push(`Row ${i + 1}: System ID ${systemCode} already exists`);
                  skipped += 1;
                  continue;
                }
              } else {
                systemCode = await allocateSystemCode(prisma, systemType);
              }
              const parsed = parseSystemCode(systemCode);
              const finalType = parsed?.prefix || systemType;
              await prisma.informationSystem.create({
                data: {
                  company: companyRaw,
                  name,
                  systemCode,
                  systemType: finalType,
                  ...payload,
                },
              });
              created += 1;
            }
          } catch (err) {
            errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'failed'}`);
          }
        }

        await auditFromRequest(prisma, req, {
          category: 'data',
          action: 'create',
          entityType: 'information_system',
          entityId: '',
          entityLabel: 'IS registry import',
          summary: `Imported IS registry: created ${created}, updated ${updated}, skipped ${skipped}`,
          metadata: { created, updated, skipped, errors: errors.slice(0, 20) },
        });

        res.json({ created, updated, skipped, errors: errors.slice(0, 50) });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to import information systems' });
      }
    },
  );
}
