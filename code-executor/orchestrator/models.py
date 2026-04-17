# Mirrors ProblemInputOutput#Parameter
from typing import List, Optional, Literal, Union

from pydantic import BaseModel

class Parameter(BaseModel):
    name: str
    type: Literal[
        "string",
        "number",
        "boolean",
        "array_string",
        "array_number",
        "array_array_string",
        "array_array_number"
    ]
    value: Optional[str] = None

# Mirrors GameTestCasesContext.tsx#TestableCase
class TestableCase(BaseModel):
    id: int
    functionInput: List[Parameter]
    expectedOutput: Parameter
    computedOutput: Optional[str] = None


class ExecutionRequest(BaseModel):
    language: str
    code: str
    testCases: str = None
    runIDs: Union[str, List[int]] = None