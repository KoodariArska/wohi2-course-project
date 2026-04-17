const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const seedQuestions = [
  {
    title: "What software company is headquartered in Redmond, Washington?",
    answer: "Microsoft",
    keywords: ["business"],
  },
  {
    title: "What phone company produced the 3310?",
    answer: "Nokia",
    keywords: ["business"],
  },
  {
    title: "What is the world's largest retailer as of 2026?",
    answer: "Walmart",
    keywords: ["retail"],
  },
  {
    title: "What is a word, phrase, number, or other sequence of characters that reads the same backward as forward?",
    answer: "Palindrome",
    keywords: ["words"],
  },
];

async function main() {
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();

  for (const question of seedQuestions) {
    await prisma.question.create({
      data: {
        title: question.title,
        answer: question.answer,
        keywords: {
          connectOrCreate: question.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
