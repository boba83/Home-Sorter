import './loadEnv.js';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@home-sorter.local';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: 'Administrator',
      role: 'admin',
    },
  });

  const columnCount = await prisma.column.count();
  if (columnCount === 0) {
    await prisma.column.createMany({
      data: [
        { name: 'Za uraditi', order: 0 },
        { name: 'U toku', order: 1 },
        { name: 'Završeno', order: 2 },
      ],
    });
  }

  const excursionCount = await prisma.excursion.count();
  if (excursionCount === 0) {
    await prisma.excursion.createMany({
      data: [
        { name: 'Robinzon', adlPrice: 36, icon: 'boat', theme: 'cyan', sortOrder: 0 },
        { name: 'Plava laguna', adlPrice: 34, icon: 'boat', theme: 'blue', sortOrder: 1 },
        { name: 'Atos', adlPrice: 29, icon: 'boat', theme: 'violet', sortOrder: 2 },
        { name: 'Sunset', adlPrice: 16, icon: 'boat', theme: 'orange', sortOrder: 3 },
        { name: 'Solun', adlPrice: 30, icon: 'bus', theme: 'emerald', sortOrder: 4 },
      ],
    });
  }

  console.log('Seed OK');
  console.log(`Login: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
