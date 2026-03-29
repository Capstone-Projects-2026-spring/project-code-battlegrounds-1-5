import { ParameterType } from "@/lib/ProblemInputOutput";
import {
  createContext,
  useContext,
  useState,
  useRef,
  type ReactNode,
  type SetStateAction
} from "react";

export interface TestableCase {
  id: number;
  functionInput: ParameterType[];
  expectedOutput: ParameterType[];
}

export interface GameTestCasesContextAPI {
  parameters: ParameterType[],
  setParameters: React.Dispatch<SetStateAction<ParameterType[]>>,

  cases: TestableCase[],
  addCase: (testCase: TestableCase) => void;
  removeCase: (caseID: TestableCase["id"]) => void;
  updateCase: (testCase: TestableCase) => void;
}

export const GameTestCasesContext = createContext<GameTestCasesContextAPI | null>(null);

export const GameTestCasesProvider = ({ children }: { children: ReactNode }) => {
  const [parameters, setParameters] = useState<ParameterType[]>([
    { name: "nums", type: "array_number", value: null },
    { name: "target", type: "number", value: null }
  ]);
  const [cases, setCases] = useState<TestableCase[]>([
    {
      id: 0,
      functionInput: [
        { name: "nums", type: "array_number", value: "[2, 7, 11, 15]" },
        { name: "target", type: "number", value: "9" }
      ],
      expectedOutput: [
        { name: "result", type: "array_number", value: "[0, 1]", isOutputParameter: true }
      ]
    }
  ]);

  const addCase = (testCase: TestableCase) => {
    setCases(c => ([...c, testCase]));
  };
  const removeCase = (caseID: TestableCase["id"]) => {
    setCases(prev => prev.filter(c => c.id !== caseID));
  };
  const updateCase = (testCase: TestableCase) => {
    setCases(prev => prev.map(c => c.id === testCase.id ? testCase : c));
  };

  const providerRef = useRef<GameTestCasesContextAPI | null>(null);
  if (providerRef.current === null) {
    providerRef.current = {
      parameters,
      setParameters,

      cases,
      addCase,
      removeCase,
      updateCase
    };
  }

  return (
    // eslint-disable-next-line react-hooks/refs
    <GameTestCasesContext.Provider value={providerRef.current}>
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