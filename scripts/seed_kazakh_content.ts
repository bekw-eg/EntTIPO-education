import { PrismaClient } from '@prisma/client';
import { seedKazakhContent } from '../prisma/kazakhSeed';
const prisma = new PrismaClient();
seedKazakhContent(prisma).then(result => console.log('Kazakh content updated in place:', result))
  .catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
