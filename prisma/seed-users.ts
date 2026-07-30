import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD || 'grc123';

const ALL_COMPANIES = JSON.stringify([
  'NovaPay LLC',
  'Novapay Solutions',
  'Novapay Moldova',
  'NovaPay EU UAB',
]);

const SEED_USERS = [
  { email: 'admin@novapay.ua', name: 'Admin User', role: 'admin', companies: ALL_COMPANIES },
  { email: 'auditor@novapay.ua', name: 'Audit User', role: 'auditor', companies: ALL_COMPANIES },
  { email: 'approver@novapay.ua', name: 'Approver User', role: 'approver', companies: ALL_COMPANIES },
  { email: 'implementer@novapay.ua', name: 'Implementer User', role: 'implementer', companies: ALL_COMPANIES },
  { email: 'reviewer@novapay.ua', name: 'Reviewer User', role: 'reviewer', companies: ALL_COMPANIES },
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, active: true, companies: u.companies },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        active: true,
        companies: u.companies,
      },
    });
    console.log(`User ready: ${u.email} (${u.role}) companies=${u.companies}`);
  }

  console.log(`Default password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
