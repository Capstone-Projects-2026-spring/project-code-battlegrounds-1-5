import { PrismaClient, GameStatus, ProblemDifficulty, Role } from "@prisma/client";
import { auth } from "../src/lib/auth";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Starting seed...");

  // ── Users via better-auth ──
  const userDefs = [
    { name: "Alice", email: "alice@test.com" },
    { name: "Bob", email: "bob@test.com" },
    { name: "Charlie", email: "charlie@test.com" },
    { name: "Diana", email: "diana@test.com" },
  ];

  for (const u of userDefs) {
    await auth.api
      .signUpEmail({ body: { ...u, password: "password123" } })
      .catch(() => console.log(`${u.name} already exists, skipping...`));
  }

  const [alice, bob, charlie, diana] = await Promise.all(
    userDefs.map((u) => prisma.user.findUniqueOrThrow({ where: { email: u.email } }))
  );

  console.log("Users created");

  // ── Problems (let Prisma generate IDs) ──
  const easyProblem = await prisma.problem.create({
    data: {
      difficulty: ProblemDifficulty.EASY,
      problemDescription:
        "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
      tests: {
        create: [
          {
            language: "javascript",
            testCode: `
              const result = solution([2, 7, 11, 15], 9);
              console.assert(JSON.stringify(result) === JSON.stringify([0, 1]), "Test 1 failed");
            `,
            optimalTimeMs: 100,
          },
          {
            language: "javascript",
            testCode: `
              const result = solution([3, 2, 4], 6);
              console.assert(JSON.stringify(result) === JSON.stringify([1, 2]), "Test 2 failed");
            `,
            optimalTimeMs: 100,
          },
        ],
      },
    },
  });

  await prisma.problem.create({
    data: {
      difficulty: ProblemDifficulty.MEDIUM,
      problemDescription:
        "Given a string, find the length of the longest substring without repeating characters.",
      tests: {
        create: [
          {
            language: "javascript",
            testCode: `
              const result = solution("abcabcbb");
              console.assert(result === 3, "Test 1 failed");
            `,
            optimalTimeMs: 150,
          },
          {
            language: "javascript",
            testCode: `
              const result = solution("pwwkew");
              console.assert(result === 3, "Test 2 failed");
            `,
            optimalTimeMs: 150,
          },
        ],
      },
    },
  });

  await prisma.problem.create({
    data: {
      difficulty: ProblemDifficulty.HARD,
      problemDescription:
        "Given two sorted arrays, return the median of the two arrays in O(log(m+n)) time.",
      tests: {
        create: [
          {
            language: "javascript",
            testCode: `
              const result = solution([1, 3], [2]);
              console.assert(result === 2.0, "Test 1 failed");
            `,
            optimalTimeMs: 200,
          },
          {
            language: "javascript",
            testCode: `
              const result = solution([1, 2], [3, 4]);
              console.assert(result === 2.5, "Test 2 failed");
            `,
            optimalTimeMs: 200,
          },
        ],
      },
    },
  });

  console.log("Problems created");

  // ── Game Room (completed, using easy problem) ──
  const gameRoom = await prisma.gameRoom.create({
    data: {
      status: GameStatus.FINISHED,
      problemId: easyProblem.id,
      endedAt: new Date(),
    },
  });

  console.log("Game room created");

  // ── Teams (Alice + Charlie vs Bob + Diana) ──
  const team1 = await prisma.team.create({
    data: {
      gameRoomId: gameRoom.id,
      players: {
        create: [{ userId: alice.id, role: Role.CODER }, { userId: charlie.id, role: Role.TESTER }],
      },
    },
  });

  await prisma.team.create({
    data: {
      gameRoomId: gameRoom.id,
      players: {
        create: [{ userId: bob.id, role: Role.CODER }, { userId: diana.id, role: Role.TESTER }],
      },
    },
  });

  console.log("Teams created");

  // ── Game Result (Team 1 won) ──
  await prisma.gameResult.create({
    data: {
      gameRoomId: gameRoom.id,
      winningTeamId: team1.id,
      bestCode: `function solution(nums, target) {
  const map = {};
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map[complement] !== undefined) return [map[complement], i];
    map[nums[i]] = i;
  }
}`,
      timeToPassMs: 287,
    },
  });

  console.log("Game result created");
  console.log("Seeding complete!");
  console.log("");
  console.log("   alice@test.com   / password123");
  console.log("   bob@test.com     / password123");
  console.log("   charlie@test.com / password123");
  console.log("   diana@test.com   / password123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });