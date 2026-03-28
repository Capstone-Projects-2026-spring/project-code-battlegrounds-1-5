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
  expectedOutput: ParameterType;
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
  const [parameters, setParameters] = useState<ParameterType[]>([]);
  const [cases, setCases] = useState<TestableCase[]>([]);

  const addCase = (testCase: TestableCase) => {
    setCases(c => ([...c, testCase]))
  }
  const removeCase = (caseID: TestableCase["id"]) => {
    setCases(prev => prev.filter(c => c.id !== caseID))
  }
  const updateCase = (testCase: TestableCase) => {
    setCases(prev => prev.map(c => c.id === testCase.id ? testCase : c))
  }

  const providerRef = useRef<GameTestCasesContextAPI | null>(null);
  if (providerRef.current === null) {
    providerRef.current = {
      parameters,
      setParameters,

      cases,
      addCase,
      removeCase,
      updateCase
    }
  }

  return (
    // eslint-disable-next-line react-hooks/refs
    <GameTestCasesContext.Provider value={providerRef.current}>
      {children}
    </GameTestCasesContext.Provider>
  )
}

export function useTestCases() {
  const ctx = useContext(GameTestCasesContext);
  if (!ctx) {
    throw new Error("useTestCases must be used within a GameTestCasesProvider");
  }

  return ctx;
}