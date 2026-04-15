# write to file with its extension, catching error if langauge is not implemented.
# returns None if langauge is not implemented or the filename written to
import json
import os
import random
import string
import subprocess
import time
from typing import Any

from  models import *

class Languages:
    map_exts = {
        "javascript": "js",
        # "python": ".py",
    }
    map_commands = {
        "javascript": ["/usr/bin/node", "--max-old-space-size=64"]
    }

    @classmethod
    def is_supported(cls, language: str) -> bool:
        return language in cls.map_exts

def run_in_sandbox(
        code: str,
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
        ]
        cmd += Languages.map_commands[language]
        cmd.append(f"/{host_code_path}")

        # ensure we pipe
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # get output and stop timer
        stdout, stderr = process.communicate("", timeout=3)
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
                # os.remove(os.path.join("./rootfs", host_code_path)) # this line doesnt remove the file copied into the tmp rootfs. why? not touching it rn as it is only in the container which is disposable
        except Exception:
            pass

def _format_js_args(params: List[Parameter]): # TODO: this is potentially the ugliest python function i've ever written. how can we clean up? leaving it for now as i have not had issues with it so far and busy busy
    res = []
    for p in params:
        match p.type:
            case "string":
                res.append(f"\"{p.value}\"")
            case "number":
                res.append(f"{p.value}")
            case "boolean":
                res.append(f"{p.value}")
            case "array_string":
                res.append(f"[ {', '.join(f'\"{v}\"' for v in json.loads(p.value))} ]")
            case "array_number":
                res.append(f"[ {', '.join(f'{v}' for v in json.loads(p.value))} ]")
            case "array_array_string":
                res.append(f"[ { ', '.join(f'[ {", ".join(f"\"{v}\"" for v in inner)} ]' for inner in json.loads(p.value))} ]")
            case "array_array_number":
                res.append(f"[ { ', '.join(f'[ {", ".join(f"{v}" for v in inner)} ]' for inner in json.loads(p.value))} ]")
    return ', '.join(res)

def format_js_args(arg: Any):
    if isinstance(arg, TestableCase):
        return _format_js_args(arg.functionInput)
    elif isinstance(arg, Parameter):
        return _format_js_args([arg])
    return None


def write_code_to_file(content: str, language: str, testCase: TestableCase = None):
    try:
        lang_ext = Languages.map_exts[language]
    except KeyError:
        return None
    name = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    invocation = ""
    if language == 'javascript' and testCase is not None:
        param = (format_js_args(testCase))
        invocation = f"\nconsole.log(solution({param}));"
        # print(content + invocation)
    with open(f"/tmp/{name}.{lang_ext}", "w+") as f:
        f.write(content)
        f.write(invocation)
    return f"/tmp/{name}.{lang_ext}"