const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const submission = await prisma.submission.findUnique({
    where: { id: '7b8fec46-4bcf-4b2d-840f-bf3d67b20524' }
  });
  console.log(JSON.stringify(submission.chambersData, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
