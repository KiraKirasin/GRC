import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { NBM29_CONTROLS, NBM29_FRAMEWORK } from './nbm29-controls.js';

const FRAMEWORK = NBM29_FRAMEWORK;
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Importing ${NBM29_CONTROLS.length} NBM Regulation №29 controls into Controls Repository...`);

  const deleted = await prisma.gRCControl.deleteMany({
    where: {
      OR: [
        { framework: FRAMEWORK },
        { framework: 'NBM Decision №29' },
        { framework: 'НБМ №29' },
        { controlCode: { startsWith: 'NBM29-' } },
      ],
    },
  });
  console.log(`Removed ${deleted.count} existing NBM №29 controls`);

  const batchSize = 50;
  for (let i = 0; i < NBM29_CONTROLS.length; i += batchSize) {
    const batch = NBM29_CONTROLS.slice(i, i + batchSize).map((c) => ({
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
      controlDesign: c.note || '',
      source: c.source,
      accessList: '[]',
      lastReviewed: '',
    }));
    await prisma.gRCControl.createMany({ data: batch });
    console.log(`  Inserted ${Math.min(i + batchSize, NBM29_CONTROLS.length)} / ${NBM29_CONTROLS.length}`);
  }

  const count = await prisma.gRCControl.count({ where: { framework: FRAMEWORK } });
  console.log(`NBM Regulation №29 controls in repository: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
