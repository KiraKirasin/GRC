import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { backfillMissingSystemCodes } from '../server/is-registry-codes.js';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

const count = await backfillMissingSystemCodes(prisma);
console.log(`Assigned system IDs to ${count} information system(s).`);
await prisma.$disconnect();
