import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { Problem, ProblemDifficulty, Prisma } from "@prisma/client";

export interface Question {
  id: string;
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
  hints: string[];
}

export interface QuestionQuery {
  id?: string;
  slug?: string;
  difficulty?: string;
  topic?: string;
}

interface SuccessfulResponse {
  question: Question,
  error: null
}
interface FailedResponse {
  question: null,
  error: unknown
}
export type QuestionAPIResponse = SuccessfulResponse | FailedResponse;

const DIFFICULTY_LABEL: Record<ProblemDifficulty, Question["difficulty"]> = {
  [ProblemDifficulty.EASY]: "Easy",
  [ProblemDifficulty.MEDIUM]: "Medium",
  [ProblemDifficulty.HARD]: "Hard",
};

function mapToQuestion(p: Problem): Question {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    text: p.description,
    topics: p.topics,
    difficulty: DIFFICULTY_LABEL[p.difficulty],
    successRate: p.successRate,
    totalSubmissions: p.totalSubmissions,
    totalAccepted: p.totalAccepted,
    likes: p.likes,
    dislikes: p.dislikes,
    hints: p.hints ? p.hints.split(",").map((h) => h.trim()).filter(Boolean) : [],
  };
}

/**
 * GET /api/question
 *
 * Query parameters:
 *   id         – return the question with this UUID
 *   slug       – return the question with this slug
 *   difficulty – Easy | Medium | Hard  (picks a random match)
 *   topic      – partial, case-insensitive match against topic tags (picks a random match)
 *
 * Always returns a single { question } object.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<QuestionAPIResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ question: null, error: "Method not allowed" });
  }

  try {
    const { id, slug, difficulty, topic } = req.query as QuestionQuery;

    // Build where clause based on query params
    const where: Prisma.ProblemWhereInput = {};

    if (id) {
      where.id = id;
    }

    if (slug) {
      where.slug = slug;
    }

    if (difficulty) {
      const d = difficulty.toLowerCase();
      switch(d) {
        case "easy": {
          where.difficulty = ProblemDifficulty.EASY;
          break;
        }
        case "medium": {
          where.difficulty = ProblemDifficulty.MEDIUM;
          break;
        }
        case "hard": {
          where.difficulty = ProblemDifficulty.HARD;
          break;
        }
        default: {
          return res.status(400).json({
            question: null,
            error: "Unknown difficulty. Pick from `easy`, `medium`, or `hard`"
          });
        }
      }
    }

    if (topic) {
      where.topics = {
        has: topic,
      };
    }

    const problems = await prisma.problem.findMany({ where });

    if (problems.length === 0) {
      return res.status(404).json({ question: null, error: "No questions match the given filters" });
    }

    // Pick a random problem from results
    const randomProblem = problems[Math.floor(Math.random() * problems.length)];
    const question = mapToQuestion(randomProblem);

    return res.status(200).json({ question, error: null });
  } catch (err) {
    console.error("[/api/question]", err);
    return res.status(500).json({ question: null, error: "Failed to load questions" });
  }
}