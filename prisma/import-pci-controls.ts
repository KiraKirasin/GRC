import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PCI_DSS_CONTROLS } from './pci-dss-controls.js';

const FRAMEWORK = 'PCI DSS 4.0';
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Importing ${PCI_DSS_CONTROLS.length} PCI DSS controls into Controls Repository...`);

  const deleted = await prisma.gRCControl.deleteMany({
    where: {
      OR: [
        { framework: FRAMEWORK },
        { framework: 'PCI DSS' },
        { controlCode: { startsWith: 'PCI-' } },
      ],
    },
  });
  console.log(`Removed ${deleted.count} existing PCI DSS controls`);

  const batchSize = 50;
  for (let i = 0; i < PCI_DSS_CONTROLS.length; i += batchSize) {
    const batch = PCI_DSS_CONTROLS.slice(i, i + batchSize).map(c => ({
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
    console.log(`  Inserted ${Math.min(i + batchSize, PCI_DSS_CONTROLS.length)} / ${PCI_DSS_CONTROLS.length}`);
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
