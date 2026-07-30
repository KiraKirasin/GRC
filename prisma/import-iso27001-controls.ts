import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { ISO27001_CONTROLS } from './iso27001-controls.js';

const FRAMEWORK = 'ISO 27001';
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL || 'file:./grc.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Importing ${ISO27001_CONTROLS.length} ISO 27001:2022 Annex A controls into Controls Repository...`);

  const deleted = await prisma.gRCControl.deleteMany({
    where: {
      OR: [
        { framework: FRAMEWORK },
        { framework: 'ISO 27001:2022' },
        { framework: 'ISO/IEC 27001' },
        { controlCode: { startsWith: 'ISO-' } },
      ],
    },
  });
  console.log(`Removed ${deleted.count} existing ISO 27001 controls`);

  const batchSize = 50;
  for (let i = 0; i < ISO27001_CONTROLS.length; i += batchSize) {
    const batch = ISO27001_CONTROLS.slice(i, i + batchSize).map(c => ({
      controlCode: c.controlCode,
      title: `${c.titleEn} | ${c.titleUk}`,
      description: `EN: ${c.descriptionEn}\n\nUK: ${c.descriptionUk}`,
      framework: FRAMEWORK,
      category: `${c.categoryEn} / ${c.categoryUk}`,
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
    console.log(`  Inserted ${Math.min(i + batchSize, ISO27001_CONTROLS.length)} / ${ISO27001_CONTROLS.length}`);
  }

  const count = await prisma.gRCControl.count({ where: { framework: FRAMEWORK } });
  console.log(`ISO 27001 controls in repository: ${count}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
