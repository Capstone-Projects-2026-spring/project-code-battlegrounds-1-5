import { PrismaClient, GameStatus, ProblemDifficulty, Role, GameType } from "@prisma/client";
import { auth } from "../src/lib/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import * as csv from "csv";
import * as fs from "node:fs";
import * as path from "node:path";
import * as z from "zod";
import { TestCase } from "@/lib/ProblemInputOutput";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({
  adapter,
});

function parseDifficulty(val: string): ProblemDifficulty {
  const normalized = val.trim().toUpperCase();
  if (normalized === "EASY") return ProblemDifficulty.EASY;
  if (normalized === "MEDIUM") return ProblemDifficulty.MEDIUM;
  if (normalized === "HARD") return ProblemDifficulty.HARD;
  throw new Error(`Unknown difficulty: "${val}"`);
}

async function main() {
  console.log("Starting seed...");

  // ── Users via better-auth ──
  const userDefs = [
    { name: "Alice", email: "alice@test.com" },
    { name: "Bob", email: "bob@test.com" },
    { name: "Charlie", email: "charlie@test.com" },
    { name: "Diana", email: "diana@test.com" },
    { name: "Erik", email: "erik@test.com" }
  ];

  const password = process.env.TEST_ACCS_PASSWORD ?? "password123"
  for (const u of userDefs) {
    await auth.api
      .signUpEmail({ body: { ...u, password: password } })
      .catch(() => console.log(`${u.name} already exists, skipping...`));
  }

  const [alice, bob, charlie, diana, erik] = await Promise.all(
    userDefs.map((u) => prisma.user.findUniqueOrThrow({ where: { email: u.email } }))
  );

  console.log("Users created");

  // ── Problems from CSV ──
  const csvPath = path.join(__dirname, "../public/dataset.csv");
  const parser = fs.createReadStream(csvPath).pipe(
    csv.parse({
      delimiter: ",",
      trim: true,
      columns: true,
      skip_empty_lines: true,
    })
  );

  const problemsData: {
    title: string;
    slug: string;
    description: string;
    topics: string[];
    difficulty: ProblemDifficulty;
    successRate: number;
    totalSubmissions: number;
    totalAccepted: number;
    likes: number;
    dislikes: number;
    hints: string;
  }[] = [];

  const seenSlugs = new Set<string>();
  const DEMO_MODE = process.env.DEMO_MODE ?? false
  for await (const row of parser) {
    const slug = row["Question Slug"];
    if (seenSlugs.has(slug)) {
      console.warn(`Duplicate slug skipped: "${slug}" (title: "${row["Question Title"]}")`);
      continue;
    }
    seenSlugs.add(slug);
    // if demo mode is set and slug is not two sum skip
    if (DEMO_MODE && slug !== "two-sum") {
      continue;
    }
    problemsData.push({
      title: row["Question Title"],
      slug,
      description: row["Question Text"],
      topics: row["Topic Tagged text"]
        ? row["Topic Tagged text"].split(",").map((t: string) => t.trim())
        : [],
      difficulty: parseDifficulty(row["Difficulty Level"]),
      successRate: parseFloat(row["Success Rate"]),
      totalSubmissions: parseInt(row["total submission"], 10),
      totalAccepted: parseInt(row["total accepted"], 10),
      likes: parseInt(row["Likes"], 10),
      dislikes: parseInt(row["Dislikes"], 10),
      hints: row["Hints"],
    });
  }

  await prisma.problem.createMany({ data: problemsData, skipDuplicates: true });
  console.log(`Problems created: ${problemsData.length}`);

  // ── Problem Tests from JSON ──
  const testCasesPath = path.join(__dirname, "../public/test-cases.json");
  console.log("Loading test cases...");
  const testCasesRaw = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));

  console.log(`Loaded ${testCasesRaw.length} test cases...`);
  console.log("Sample case:", testCasesRaw[0]);

  const TestCaseArray = z.array(TestCase);
  const { data: testCases, success, error } = TestCaseArray.safeParse(testCasesRaw);
  if (!success) {
    console.error("Error parsing test cases:", error);
    process.exit(1);
  } else {
    console.log("Successfully parsed test cases");
  }

  // only create test cases for slug two-sum when demo mode is enabled
  const filteredTestCases = DEMO_MODE
    ? testCases.filter((tc) => tc.problemId === "two-sum")
    : testCases;

  const mapped = filteredTestCases.map((tc) => ({
    problemId: tc.problemId,
    functionInput: tc.functionInput,
    expectedOutput: tc.expectedOutput,
    language: tc.language,
    optimalTimeMs: tc.optimalTimeMs,
  }));

  // const p: string[] = []
  // for (const c of mapped) {
  //   await prisma.problemTest.create({
  //     data: c,
  //   }).catch(e => {
  //     console.error("cant insert:", c.problemId);
  //     p.push(c.problemId);
  //     // process.exit(1);
  //   });
  // }
  // console.log(new Set([...p]));
  // if(p.length !== 0) process.exit(1);
  await prisma.problemTest.createMany({ data: mapped, skipDuplicates: true });

  console.log(`Test cases created: ${mapped.length}`);

  // ── Game Room (completed, using first easy problem) ──
  const easyProblem = await prisma.problem.findFirstOrThrow({
    where: { difficulty: ProblemDifficulty.EASY },
  });

  const gameRoom = await prisma.gameRoom.create({
    data: {
      status: GameStatus.FINISHED,
      problemId: easyProblem.id,
      endedAt: new Date(),
      gameType: GameType.FOURPLAYER
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
      team1Code: `function solution(nums, target) {
  const map = {};
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map[complement] !== undefined) return [map[complement], i];
    map[nums[i]] = i;
  }
}`,
      team1TimeToPassMs: 287,
    },
  });

  console.log("Game result created");
  console.log("Seeding complete!");
  console.log("");
  console.log("   alice@test.com");
  console.log("   bob@test.com");
  console.log("   charlie@test.com");
  console.log("   diana@test.com");
  console.log("   erik@test.com");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    console.log("Disconnecting...");
    await prisma.$disconnect();
  });