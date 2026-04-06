import { ParameterType } from "@/lib/ProblemInputOutput";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";

export interface TestableCase {
  id: number;
  functionInput: ParameterType[];
  expectedOutput: ParameterType;
  computedOutput?: string | null;
}

export interface GameTestCasesContextAPI {
  parameters: ParameterType[],
  setParameters: React.Dispatch<SetStateAction<ParameterType[]>>,

  cases: TestableCase[],
  setCases: React.Dispatch<SetStateAction<TestableCase[]>>
  addCase: (testCase: TestableCase) => void;
  removeCase: (caseID: TestableCase["id"]) => void;
  updateCase: (testCase: TestableCase) => void;
}

export const GameTestCasesContext = createContext<GameTestCasesContextAPI | null>(null);

export const DEFAULT_TEST_CASES: TestableCase[] = [
  {
    id: 0,
    functionInput: [
      { name: "a", type: "number", value: "2" },
      { name: "b", type: "number", value: "3" }
    ],
    expectedOutput:
      { name: "result", type: "number", value: "5", isOutputParameter: true }
  }
];

export const GameTestCasesProvider = ({ children }: { children: ReactNode }) => {
  const [parameters, setParameters] = useState<ParameterType[]>([
    { name: "a", type: "number", value: null },
    { name: "b", type: "number", value: null },
    { name: "result", type: "number", value: null, isOutputParameter: true }
  ]);
  const [cases, setCases] = useState<TestableCase[]>(DEFAULT_TEST_CASES);

  const addCase = (testCase: TestableCase) => {
    console.log("adding a new case!", "existing cases", cases, "new case", testCase);
    setCases(c => ([...c, testCase]));
  };
  const removeCase = (caseID: TestableCase["id"]) => {
    setCases(prev => prev.filter(c => c.id !== caseID));
  };
  const updateCase = (testCase: TestableCase) => {
    setCases(prev => prev.map(c => c.id === testCase.id ? testCase : c));
  };

  const contextValue: GameTestCasesContextAPI = {
    parameters,
    setParameters,
    cases,
    setCases,
    addCase,
    removeCase,
    updateCase
  };

  return (
    <GameTestCasesContext.Provider value={contextValue}>
      {children}
    </GameTestCasesContext.Provider>
  );
};

export function useTestCases() {
  const ctx = useContext(GameTestCasesContext);
  if (!ctx) {
    throw new Error("useTestCases must be used within a GameTestCasesProvider");
  }

  return ctx;
}