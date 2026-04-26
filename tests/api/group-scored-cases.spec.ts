import { describe, test, expect } from "@jest/globals";
import { groupScoredCases } from "@/util/groupScoredCases";

describe("groupScoredCases", () => {
  test("keeps separate rows when inputs are identical but ids differ", () => {
    const sharedInput = [{ name: "nums", type: "number[]", value: "[1,2]" }];
    const expected = [{ name: "result", type: "number", value: 3 }];

    const tests = [
      { id: "hidden-1", input: sharedInput, expected },
      { id: "hidden-2", input: sharedInput, expected },
    ];

    const grouped = groupScoredCases(
      tests,
      1,
      [3, 4],
      [3, 4],
      [null, null],
      [null, null]
    );

    expect(grouped).toHaveLength(2);
    expect(grouped.map((row) => row.id)).toEqual(["hidden-1", "hidden-2"]);
    expect(grouped[0]?.yourResult).toBe(3);
    expect(grouped[1]?.yourResult).toBe(4);
  });
});
