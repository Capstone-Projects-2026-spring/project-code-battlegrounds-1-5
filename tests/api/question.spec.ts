// Tests the question API endpoint
// Next server must be running on port 8080 to run properly
// (or you can just set the env variables)

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

// Tests whether the server is actually running. Will fail early if not.
beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/hello`);
  expect(res.ok).toBeTruthy();
});

describe("200 OKs", () => {

  test("ID=1", async () => {
    const json = await get({ id: "1" });
    if (json.error) {
      fail(json.error);
      // return unreachable
    }

    expect(json.question?.questionId).toBeTruthy();
  });

  test("slug=two-sum", async () => {
    const json = await get({ slug: "two-sum" });
    if (json.error) {
      fail(json.error);
    }

    expect(json.question?.slug).toEqual("two-sum");
  });

  test("difficulty=Easy", async () => {
    const json = await get({ difficulty: "Easy" });
    if (json.error) {
      fail(json.error);
    }

    expect(json.question).not.toBeNull();
  });
})