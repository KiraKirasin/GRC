import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { NBU95_CONTROLS } from './nbu95-controls.js';

const FRAMEWORK = 'NBU Resolution №95';
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Importing ${NBU95_CONTROLS.length} NBU №95 controls into Controls Repository...`);

  const deleted = await prisma.gRCControl.deleteMany({
    where: {
      OR: [
        { framework: FRAMEWORK },
        { controlCode: { startsWith: 'NBU95-' } },
      ],
    },
  });
  console.log(`Removed ${deleted.count} existing NBU №95 controls`);

  const batchSize = 50;
  for (let i = 0; i < NBU95_CONTROLS.length; i += batchSize) {
    const batch = NBU95_CONTROLS.slice(i, i + batchSize).map(c => ({
      controlCode: c.controlCode,
      title: c.title,
      description: c.description,
      framework: FRAMEWORK,
      category: c.category,
      status: 'pending',
      owner: '',
      evidence: '[]',
      evidenceLinks: '[]',
      attachments: '[]',
      controlDesign: '',
      source: c.source,
      accessList: '[]',
      lastReviewed: '',
    }));
    await prisma.gRCControl.createMany({ data: batch });
    console.log(`  Inserted ${Math.min(i + batchSize, NBU95_CONTROLS.length)} / ${NBU95_CONTROLS.length}`);
  }

  const byFw = await prisma.gRCControl.groupBy({
    by: ['framework'],
    _count: { _all: true },
  });
  console.log('Controls Repository by framework:');
  for (const row of byFw) {
    console.log(`  ${row.framework}: ${row._count._all}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
