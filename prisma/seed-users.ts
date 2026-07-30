import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD || 'grc123';

const COMPANIES = [
  'NovaPay LLC',
  'Novapay Solutions',
  'Novapay Moldova',
  'NovaPay EU UAB',
] as const;

function accessForRole(role: string) {
  return JSON.stringify(Object.fromEntries(COMPANIES.map(c => [c, role])));
}

const SEED_USERS = [
  { email: 'admin@novapay.ua', name: 'Admin User', role: 'admin' },
  { email: 'auditor@novapay.ua', name: 'Audit User', role: 'auditor' },
  { email: 'approver@novapay.ua', name: 'Approver User', role: 'approver' },
  { email: 'implementer@novapay.ua', name: 'Implementer User', role: 'implementer' },
  { email: 'reviewer@novapay.ua', name: 'Reviewer User', role: 'reviewer' },
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const u of SEED_USERS) {
    const companies = accessForRole(u.role);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true, companies },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        active: true,
        companies,
      },
    });
    console.log(`User ready: ${u.email} (${u.role}) companies=${companies}`);
  }

  console.log(`Default password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
