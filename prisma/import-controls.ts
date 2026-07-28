import 'dotenv/config';
import * as fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import XLSX from 'xlsx';

const DEFAULT_XLSX = '/Users/kirasavchenko/Library/Mobile Documents/com~apple~CloudDocs/NovaPay/NBU/NovaPay_Enterprise_Control_Library (1).xlsx';
const FRAMEWORK = 'Enterprise Control Library';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

type ExcelRow = Record<string, unknown>;

function str(value: unknown): string {
  if (value == null || (typeof value === 'number' && Number.isNaN(value))) return '';
  return String(value).trim();
}

function mapStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'pass' || normalized === 'mostly pass') return 'implemented';
  if (normalized === 'partial' || normalized === 'weak') return 'in_progress';
  if (normalized === 'n/a' || normalized === 'na') return 'not_applicable';
  return 'pending';
}

function formatDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = str(value);
  if (!text) return '';
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text;
}

function buildSource(row: ExcelRow): string {
  const parts = [
    str(row['Control ID']) && `ID: ${str(row['Control ID'])}`,
    str(row['NBU 123 Reference']) && `NBU №123: ${str(row['NBU 123 Reference'])}`,
    str(row['NBU 187 Reference']) && `NBU №187: ${str(row['NBU 187 Reference'])}`,
    str(row['ISO 27001:2022']) && `ISO 27001:2022: ${str(row['ISO 27001:2022'])}`,
    str(row['DORA']) && `DORA: ${str(row['DORA'])}`,
    str(row['CRA']) && `CRA: ${str(row['CRA'])}`,
    str(row['NIST CSF 2.0']) && `NIST CSF 2.0: ${str(row['NIST CSF 2.0'])}`,
    str(row['CIS Controls v8']) && `CIS Controls v8: ${str(row['CIS Controls v8'])}`,
    str(row['PCI DSS']) && `PCI DSS: ${str(row['PCI DSS'])}`,
  ].filter(Boolean);
  return parts.join(' | ');
}

function buildControlDesign(row: ExcelRow): string {
  const parts = [
    str(row['Control Objective']) && `Objective: ${str(row['Control Objective'])}`,
    str(row['Risk Addressed']) && `Risk: ${str(row['Risk Addressed'])}`,
    str(row['Control Type']) && `Type: ${str(row['Control Type'])}`,
    str(row['Prevent/Detect/Correct']) && `PDC: ${str(row['Prevent/Detect/Correct'])}`,
    str(row['Frequency']) && `Frequency: ${str(row['Frequency'])}`,
    str(row['Criticality']) && `Criticality: ${str(row['Criticality'])}`,
    str(row['Weight']) && `Weight: ${str(row['Weight'])}`,
    str(row['Automation Level']) && `Automation: ${str(row['Automation Level'])}`,
    str(row['Test Method']) && `Test method: ${str(row['Test Method'])}`,
    str(row['Comment']) && `Comment: ${str(row['Comment'])}`,
  ].filter(Boolean);
  return parts.join('\n');
}

function mapRow(row: ExcelRow) {
  const controlId = str(row['Control ID']);
  const title = str(row['Control Title']);
  const evidenceText = str(row['Expected Evidence']);
  const evidenceLink = str(row['Evidence Link']);

  return {
    controlCode: controlId,
    title,
    description: str(row['Control Statement']),
    framework: FRAMEWORK,
    category: [str(row['Domain']), str(row['Subdomain'])].filter(Boolean).join(' / '),
    status: mapStatus(str(row['Status'])),
    owner: str(row['Control Owner']),
    evidence: evidenceText ? JSON.stringify([evidenceText]) : '[]',
    evidenceLinks: evidenceLink ? JSON.stringify([evidenceLink]) : '[]',
    attachments: '[]',
    controlDesign: buildControlDesign(row),
    source: buildSource(row),
    accessList: '[]',
    lastReviewed: formatDate(row['Last Assessment Date']),
  };
}

async function main() {
  const xlsxPath = process.argv[2] || process.env.CONTROLS_XLSX || DEFAULT_XLSX;
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`Excel file not found: ${xlsxPath}`);
  }

  console.log(`Reading controls from: ${xlsxPath}`);
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets['Enterprise Control Library'];
  if (!sheet) {
    throw new Error('Sheet "Enterprise Control Library" not found in workbook');
  }

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);
  const controls = rows
    .map(mapRow)
    .filter(c => c.title);

  console.log(`Parsed ${controls.length} controls. Replacing existing GRCControl records...`);

  await prisma.$transaction(async (tx) => {
    await tx.gRCControl.deleteMany();
    const batchSize = 100;
    for (let i = 0; i < controls.length; i += batchSize) {
      const batch = controls.slice(i, i + batchSize);
      await tx.gRCControl.createMany({ data: batch });
      console.log(`  Inserted ${Math.min(i + batchSize, controls.length)} / ${controls.length}`);
    }
  });

  const count = await prisma.gRCControl.count();
  console.log(`Done. GRCControl table now has ${count} records.`);

  const sample = await prisma.gRCControl.findFirst({ orderBy: { title: 'asc' } });
  if (sample) {
    console.log('Sample:', sample.title);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
