import base64

from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, ValidationError

from utils import *
from models import *

app = FastAPI()

@app.get("/", response_class=PlainTextResponse)
def root():
    return "Runner is up. Use POST /execute with JSON { language, code, stdin?, testCases? }"


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/execute")
def execute(req: ExecutionRequest):
    # validate language support
    if not Languages.is_supported(req.language):
        return JSONResponse(
            status_code=400,
            content={"error": f"Language '{req.language}' is not supported",
                     "supported": list(Languages.map_exts.keys())},
        )

    # The code is coming in as base 64. Decode it!
    code = base64.b64decode(req.code).decode("utf-8")
    print(code)

    # if there arent test cases we can just run it
    if req.testCases is None:
        print("No test cases. Running code")
        result = run_in_sandbox(code, req.language)
        return result

    # now we need to parse and run against each case
    results = []
    all_passed = True

    # the test cases are coming in as a json string.
    # decode to python!
    testCases = json.loads(req.testCases)
    # normalize input: allow a single object or a list of objects as frontend usually send json object not list
    if isinstance(testCases, dict):
        testCases = [testCases]
    elif not isinstance(testCases, list):
        return JSONResponse(
            status_code=400,
            content={
                "error": "testCases not type of list"
            }
        )

    # parse runIDs if provided; accept either a JSON string or an array
    run_ids_set = None
    if req.runIDs is not None:
        run_ids_raw = req.runIDs
        if isinstance(run_ids_raw, str):
            try:
                run_ids_raw = json.loads(run_ids_raw)
            except Exception:
                return JSONResponse(
                    status_code=400,
                    content={"error": "runIDs is not valid JSON array"}
                )
        if isinstance(run_ids_raw, list):
            try:
                run_ids_set = set(int(x) for x in run_ids_raw)
            except Exception:
                return JSONResponse(
                    status_code=400,
                    content={"error": "runIDs must be an array of integers"}
                )
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "runIDs must be an array"}
            )

    for test in testCases:
        # print(test)
        try:
            test = TestableCase.model_validate(test) # esnure structure is valid
        except ValidationError as e:
            print(e)
            return JSONResponse(
                status_code=400,
                content={
                    "error": e.title
                }
            )

        # yayyyyyyyyyyy list comprehension 🤤
        testCaseInputs = [test.value for test in test.functionInput]
        # print(testCaseInputs)

        # decide whether to run this test based on runIDs
        should_run = (run_ids_set is None) or (test.id in run_ids_set)
        if not should_run: # we still need to return the test to the backend, but without any outputs
            results.append({
                "id": test.id,
                "input": testCaseInputs,
                "expected": test.expectedOutput.value,
                "actual": None,
                "passed": None,
                "stderr": None,
                "execution_time_ms": None,
            })
            continue

        # run the code!
        result = run_in_sandbox(
            code=code,
            language=req.language,
            testCase=test
        )

        # check if we passed
        stdout_val = result.get("stdout", "").strip()
        # note we are formatting the expected as well, so if it's an array output we're chill
        expected_val = None
        if req.language == "javascript":
            expected_val = format_js_args(test.expectedOutput)
        error_occurred = result.get("exit_code", 0) != 0

        if error_occurred:
            passed = None
            # if there's a runtime error, overall cannot be all passed
            all_passed = False
        else:
            if expected_val is not None:
                passed = (stdout_val == expected_val)
                if not passed:
                    all_passed = False
            else:
                passed = None

        # append how we did to results
        results.append({
            "id": test.id,
            "input": testCaseInputs,
            "expected": test.expectedOutput.value,
            "actual": result.get("stdout", "").strip(),
            "passed": passed,
            "stderr": result.get("stderr", ""),
            "execution_time_ms": result.get("execution_time_ms", 0),
        })

    # return whether all cases passed and the individual results
    return {
        "all_passed": all_passed,
        "results": results,
    }
