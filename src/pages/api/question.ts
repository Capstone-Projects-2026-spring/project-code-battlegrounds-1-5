import { NextApiRequest, NextApiResponse } from "next";
import * as csv from "csv";
import * as fs from "node:fs";
import * as path from "node:path";

export interface Question {
  id: number;
  questionId: number;
  title: string;
  slug: string;
  text: string;
  topics: string[];
  difficulty: "Easy" | "Medium" | "Hard";
  successRate: number;
  totalSubmissions: number;
  totalAccepted: number;
  likes: number;
  dislikes: number;
  likeRatio: number;
  hints: string[];
  similarQuestionIds: number[];
  similarQuestionTitles: string[];
}

// Module-level cache so the CSV is only parsed once per server lifetime
let cachedQuestions: Question[] | null = null;

async function loadQuestions(): Promise<Question[]> {
  if (cachedQuestions) return cachedQuestions;

  const csvPath = path.join(process.cwd(), "public", "dataset.csv");

  const parser = fs
    .createReadStream(csvPath)
    .pipe(
      csv.parse({
        delimiter: ",",
        trim: true,
        from_line: 2,
        skipEmptyLines: true,
        skip_empty_lines: true,
        skipRecordsWithError: true,
        skip_records_with_error: true,
        skipRecordsWithEmptyValues: false,
        skip_records_with_empty_values: false,
      })
    );

  const questions: Question[] = [];

  for await (const record of parser) {
    const [
      id,
      questionId,
      title,
      slug,
      text,
      topicsRaw,
      difficulty,
      successRate,
      totalSubmissions,
      totalAccepted,
      likes,
      dislikes,
      likeRatio,
      hintsRaw,
      similarIdsRaw,
      similarTitlesRaw,
    ] = record as string[];

    questions.push({
      id: Number(id),
      questionId: Number(questionId),
      title,
      slug,
      text: text?.trim(),
      topics: topicsRaw ? topicsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
      difficulty: difficulty as Question["difficulty"],
      successRate: parseFloat(successRate) || 0,
      totalSubmissions: Number(totalSubmissions) || 0,
      totalAccepted: Number(totalAccepted) || 0,
      likes: Number(likes) || 0,
      dislikes: Number(dislikes) || 0,
      likeRatio: parseFloat(likeRatio) || 0,
      hints: hintsRaw ? hintsRaw.split(",").map((h) => h.trim()).filter(Boolean) : [],
      similarQuestionIds: similarIdsRaw
        ? similarIdsRaw.split(",").map(Number).filter(Boolean)
        : [],
      similarQuestionTitles: similarTitlesRaw
        ? similarTitlesRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    });
  }

  cachedQuestions = questions;
  return cachedQuestions;
}

/**
 * GET /api/question
 *
 * Query parameters:
 *   id         – return the question with this Question ID
 *   slug       – return the question with this slug
 *   difficulty – Easy | Medium | Hard  (picks a random match)
 *   topic      – partial, case-insensitive match against topic tags (picks a random match)
 *
 * Always returns a single { question } object.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let questions = await loadQuestions();

    const { id, slug, difficulty, topic } = req.query;

    if (id) {
      const targetId = Number(id);
      questions = questions.filter((q) => q.questionId === targetId);
    }

    if (slug) {
      questions = questions.filter((q) => q.slug === String(slug));
    }

    if (difficulty) {
      const d = String(difficulty);
      questions = questions.filter(
        (q) => q.difficulty.toLowerCase() === d.toLowerCase()
      );
    }

    if (topic) {
      const t = String(topic).toLowerCase();
      questions = questions.filter((q) =>
        q.topics.some((tag) => tag.toLowerCase().includes(t))
      );
    }

    if (questions.length === 0) {
      return res.status(404).json({ error: "No questions match the given filters" });
    }

    const question = questions[Math.floor(Math.random() * questions.length)];
    return res.status(200).json({ question });
  } catch (err) {
    console.error("[/api/question]", err);
    return res.status(500).json({ error: "Failed to load questions" });
  }
}