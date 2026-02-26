// Tests the question API endpoint
// Next server must be running on port 8080 to run properly
// (or you can just set the env variables)

import { beforeAll, describe, test, expect } from "@jest/globals";

import type { QuestionQuery, QuestionAPIResponse } from "@/pages/api/question";

const PROTO = process.env.PROTO || "http://"
const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 8080;
const BASE_URL = `${PROTO}${HOST}:${PORT}`;

async function get(opts?: QuestionQuery) {
  let url = `${BASE_URL}/api/question`;

  if (opts) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(opts)) {
      qs.append(key, val)
    }
    url += `?${qs.toString()}`;
  }

  const res = await fetch(url)
  const json: QuestionAPIResponse = await res.json();
  return json;
}

export function generatePowerSet<T extends object>(items: T[]): T[] {
  // For each new item, keep existing combos, add the item alone,
  // then add the item merged with each existing combo.
  return items.reduce<T[]>(
    (combos, item) => [
      ...combos,
      item,
      ...combos.map((existing) => ({ ...existing, ...item })),
    ],
    []
  );
}

// Tests whether the server is actually running. Will fail early if not.
beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/hello`);
  expect(res.ok).toBeTruthy();
});

describe("Simple 200 OKs", () => {

  test("ID=1", async () => {
    const json = await get({ id: "1" });

    expect(json.question?.questionId).toBeTruthy();
  });

  test("slug=two-sum", async () => {
    const json = await get({ slug: "two-sum" });

    expect(json.question?.slug).toEqual("two-sum");
  });

  test("difficulty=Easy", async () => {
    const json = await get({ difficulty: "Easy" });

    expect(json.question?.difficulty).toEqual("Easy");
  });

  test("topic=Array", async () => {
    const json = await get({ topic: "Array" });

    expect(json.question?.topics).toContain("Array");
  })
});

describe("Combined query parameters", async () => {

  // test.each([
  //   [1, 1, 2],
  //   [1, 2, 3],
  //   [2, 1, 3],
  // ])('.add(%i, %i)', (a, b, expected) => {
  //   expect(a + b).toBe(expected);
  // });

  test.each(
    generatePowerSet<QuestionQuery>([
      { id: "1" },
      { slug: "two-sum" },
      { difficulty: "Easy" },
      { topic: "Array" }
    ]).map((val) => ({
      qps: val,
    }))
  )('$qps', async ({ qps }) => {
    const json = await get(qps);
    expect(json.question?.questionId).not.toBeNull();
  })

});

describe("Known 404s", () => {

  test("difficulty=NotADifficulty", async () => {
    const json = await get({ difficulty: "NotADifficulty" });

    expect(json.error).toEqual("No questions match the given filters");
  });

})