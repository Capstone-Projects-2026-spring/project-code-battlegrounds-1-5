import os
import subprocess
import time
import base64

from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, ValidationError

from utils import *
from models import *

app = FastAPI()

# This seems backwards but we want nsjail to be on by default.
# So if the env key isn't set, it's still on # TODO: havent implemented this yet
use_nsjail = False if os.getenv("USE_NSJAIL") == "false" else True
node_path = os.getenv("NODE_PATH", "/usr/bin/node")

@app.get("/", response_class=PlainTextResponse)
def root():
    return "Runner is up. Use POST /execute with JSON { language, code, stdin?, testCases? }"


@app.get("/health")
def health():
    return {"status": "ok"}

def run_in_sandbox(
    code: str,
    stdin: str,
    language: str,
    testCase: TestableCase = None
):
    # write code to a random temp file with the correct extension

    host_code_path = write_code_to_file(code, language, testCase)
    if host_code_path is None:  # we verify on /execute but nice to be sure
        return {
            "stdout": "",
            "stderr": f"Language '{language}' is not supported",
            "exit_code": -2,
            "execution_time_ms": 0,
        }

    try:
        # get absolute paths
        project_root = os.path.dirname(os.path.abspath(__file__))
        rootfs_path = os.path.join(project_root, "rootfs")

        start_time = time.time()

        # build nsjail command
        cmd = [
            "nsjail",
            "-Mo",
            "--quiet",
            "--disable_proc",
            "--disable_clone_newnet",
            "--time_limit", "5",
            "--rlimit_as", "2048",  # 2GB to avoid oom
            "--rlimit_cpu", "2",
            "--chroot", rootfs_path,
            "--bindmount_ro", f"{host_code_path}:/{host_code_path}",
            "--user", "99999",
            "--group", "99999",
            "--",
            "/usr/bin/node",
            # "/Users/samir/.nvm/versions/node/v24.11.1/bin/node",
            # TODO: a quick mapping in languages to map language strings to executables and args
            "--max-old-space-size=64",
            f"/{host_code_path}",
        ]

        # ensure we pipe
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # get output and stop timer
        stdout, stderr = process.communicate(stdin or "", timeout=3)
        end_time = time.time()

        # return results
        return {
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": process.returncode,
            "execution_time_ms": int((end_time - start_time) * 1000),
        }

    # kill if it times out, we aren't letting code run
    except subprocess.TimeoutExpired:
        process.kill()
        return {
            "stdout": "",
            "stderr": "Time Limit Exceeded",
            "exit_code": -1,
            "execution_time_ms": 2000,
        }
    finally:
        # clean up tmp file
        try:
            if host_code_path and os.path.exists(host_code_path):
                os.remove(host_code_path)
                # os.remove(os.path.join("./rootfs", host_code_path)) # TODO: this line doesnt remove the file copied into the tmp rootfs. why? not touching it rn, got too much chit to do
        except Exception:
            pass


@app.post("/execute")
def execute(req: ExecutionRequest):
    # validate language support
    if not Languages.is_supported(req.language):
        return JSONResponse(
            status_code=400,
            content={"error": f"Language '{req.language}' is not supported",
                     "supported": list(Languages.map.keys())},
        )

    # The code is coming in as base 64. Decode it!
    code = base64.b64decode(req.code).decode("utf-8")
    print(code)

    # if there arent test cases we can just run it
    if req.testCases is None:
        print("No test cases. Running code")
        result = run_in_sandbox(code, req.stdin or "", req.language)
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

    for test in testCases:
        # print(test)
        try:
            test = TestableCase.model_validate(test)
        except ValidationError as e:
            print(e)
            return JSONResponse(
                status_code=400,
                content={
                    "error": e.title
                }
            )

        # unnngggghhhhh list comprehension 🤤
        testCaseInputs = [test.value for test in test.functionInput]
        # print(testCaseInputs)

        result = run_in_sandbox(
            code=code,
            stdin="",
            language=req.language,
            testCase=test
        )

        # check if we passed
        passed = None
        if test.expectedOutput.value is not None:
            passed = (result.get("stdout", "").strip()
                      == (test.expectedOutput.value or "").strip())
            if not passed:
                all_passed = False

        # append how we did to results
        results.append({
            "input": testCaseInputs,
            "expected": test.expectedOutput.value,
            "actual": result.get("stdout", ""),
            "passed": passed,
            "stderr": result.get("stderr", ""),
            "execution_time_ms": result.get("execution_time_ms", 0),
        })

    # return whether all cases passed and the individual results
    return {
        "all_passed": all_passed,
        "results": results,
    }
