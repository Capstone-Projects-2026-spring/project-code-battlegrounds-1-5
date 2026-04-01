import os
import string
import subprocess
import time
import random
from typing import List, Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

app = FastAPI()

@app.get("/", response_class=PlainTextResponse)
def root():
    return "Runner is up. Use POST /execute with JSON { language, code, stdin?, testCases? }"

@app.get("/health")
def health():
    return {"status": "ok"}

class Languages:
    map = {
        "javascript": "js",
        # "python": ".py",
    }

    @classmethod
    def is_supported(cls, language: str) -> bool:
        return language in cls.map

class TestCase(BaseModel):
    input: str
    expected: Optional[str] = None


class ExecutionRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = ""
    testCases: Optional[List[TestCase]] = None

# write to file with its extension, catching error if langauge is not implemented.
# returns None if langauge is not implemented or the filename written to
def write_code_to_file(content: str, language: str):
    # TODO: we should check if code compiles before running it and returning garbage.
    try:
        lang_ext = Languages.map[language]
    except KeyError:
        return None
    name = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    with open(f"/tmp/{name}.{lang_ext}", "w+") as f:
        f.write(content)
    return f"/tmp/{name}.{lang_ext}"

def run_in_sandbox(code: str, stdin: str, language: str):
    # write code to a random temp file with the correct extension
    host_code_path = write_code_to_file(code, language)
    if host_code_path is None: # we verify on /execute but nice to be sure
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
            "/usr/bin/node", # TODO: a quick mapping in languages to map language strings to executables and args
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
            content={"error": f"Language '{req.language}' is not supported", "supported": list(Languages.map.keys())},
        )

    # if there arent test cases we can just run it
    if req.testCases is None:
        result = run_in_sandbox(req.code, req.stdin or "", req.language)
        return result

    # now we need to parse and run against each case
    results = []
    all_passed = True

    for test in req.testCases:
        # For JavaScript, append a console.log(solution(...)) call per test case
        if req.language == "javascript":
            # test.input is expected to be the raw argument list, e.g. "1, 2" or "[1,2], 3"
            code_with_invocation = f"{req.code}\nconsole.log(solution({test.input}));\n"
            result = run_in_sandbox(code_with_invocation, "", req.language)
        else:
            # Fallback: previous behavior using stdin for non-JS languages (future work to extend)
            result = run_in_sandbox(req.code, test.input, req.language)

        # check if we passed
        passed = None
        if test.expected is not None:
            passed = (result.get("stdout", "").strip() == (test.expected or "").strip())
            if not passed:
                all_passed = False

        # append how we did to results
        results.append({
            "input": test.input,
            "expected": test.expected,
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
