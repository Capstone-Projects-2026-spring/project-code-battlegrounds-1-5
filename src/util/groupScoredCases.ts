import { type ParameterType } from "@/lib/ProblemInputOutput";

export interface ScoredCase {
  id: string;
  input: ParameterType[];
  expected: ParameterType[];
  yourResult: unknown;
  otherTeamResult: unknown;
  yourError: string | null;
  otherTeamError: string | null;
}

interface TestCase {
  id: string;
  input: ParameterType[];
  expected: ParameterType[];
}

export function groupScoredCases(
  convertedTests: TestCase[],
  userTeamNumber: 1 | 2,
  team1TestResults: unknown[],
  team2TestResults: unknown[],
  team1ErrorsArray: (string | null)[],
  team2ErrorsArray: (string | null)[]
): ScoredCase[] {
  if (!convertedTests.length) return [];

  const grouped = new Map<string, ScoredCase>();
  const yourResults = userTeamNumber === 2 ? team2TestResults : team1TestResults;
  const otherTeamResults = userTeamNumber === 2 ? team1TestResults : team2TestResults;
  const yourErrors = userTeamNumber === 2 ? team2ErrorsArray : team1ErrorsArray;
  const otherTeamErrors = userTeamNumber === 2 ? team1ErrorsArray : team2ErrorsArray;

  convertedTests.forEach((element, index) => {
    const key = element.id;
    const existing = grouped.get(key);
    const yourResult = yourResults?.[index];
    const otherTeamResult = otherTeamResults?.[index];
    const yourError = yourErrors?.[index] ?? null;
    const otherTeamError = otherTeamErrors?.[index] ?? null;

    if (!existing) {
      grouped.set(key, {
        id: element.id,
        input: element.input,
        expected: element.expected,
        yourResult,
        otherTeamResult,
        yourError,
        otherTeamError,
      });
      return;
    }

    if (existing.yourResult === undefined && yourResult !== undefined) {
      existing.yourResult = yourResult;
    }
    if (existing.otherTeamResult === undefined && otherTeamResult !== undefined) {
      existing.otherTeamResult = otherTeamResult;
    }
    if (!existing.yourError && yourError) {
      existing.yourError = yourError;
    }
    if (!existing.otherTeamError && otherTeamError) {
      existing.otherTeamError = otherTeamError;
    }
  });

  return Array.from(grouped.values());
}
