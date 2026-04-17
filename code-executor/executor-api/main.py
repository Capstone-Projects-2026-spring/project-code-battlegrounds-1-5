import json
import subprocess
import socket
import time
import random
import string

import requests
from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.encoders import jsonable_encoder
from models import *

app = FastAPI()

class Containers:
    map = {} # map container names to the ports they expose


class Languages:
    map = {
        "javascript": "js",
        # "python": ".py",
    }

    @classmethod
    def is_supported(cls, language: str) -> bool:
        return language in cls.map

@app.get("/", response_class=PlainTextResponse)
def root():
    return "Runner is up. Use POST /execute with JSON { language, code, stdin?, testCases? }"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/execute")
def execute(req: ExecutionRequest):
    print(json.dumps(req.dict()))
    # validate language support
    if not Languages.is_supported(req.language):
        return JSONResponse(
            status_code=400,
            content={"error": f"Language '{req.language}' is not supported", "supported": list(Languages.map.keys())},
        )

    # command is docker run -d -p 8000:8000 --cap-add=SYS_ADMIN --security-opt seccomp=unconfined runner:latest but make sure to replace the port with an open one and add a name
    # create a docker container specifically for this execute request, and save it in the Containers.map once it has started
    def _get_free_port() -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            return s.getsockname()[1]

    container_name = f"runner-{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"
    host_port = _get_free_port()

    # start docker container
    try:
        cmd = [
            "docker", "run", "-d",
            "-p", f"{host_port}:8000",
            "--cap-add=SYS_ADMIN",
            "--security-opt", "seccomp=unconfined",
            "--security-opt", "apparmor=unconfined",
            "--name", container_name,
            "runner:latest",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return JSONResponse(status_code=500, content={"error": "Failed to start executor container", "details": result.stderr.strip()})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Exception starting executor container", "details": str(e)})

    Containers.map[container_name] = host_port

    # wait for container to start by pinging /health endpoint
    base_url = f"http://127.0.0.1:{host_port}"
    healthy = False
    for _ in range(40):
        try:
            r = requests.get(f"{base_url}/health", timeout=0.1)
            if r.status_code == 200 and r.json().get("status") == "ok":
                healthy = True
                break
        except Exception:
            pass
        time.sleep(0.1)

    if not healthy:
        # cleanup
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, text=True)
        Containers.map.pop(container_name, None)
        return JSONResponse(status_code=500, content={"error": "Executor container not healthy in time"})

    # send the execution request to the container and wait for its result
    try:
        # ensure we send a proper JSON body, not a Pydantic model instance (support Pydantic v1 and v2)
        if hasattr(req, 'model_dump'):
            payload = req.model_dump(mode='json')
        else:
            payload = req.dict()
        # Final safety: coerce to JSON-serializable types
        payload = jsonable_encoder(payload)
        print(f"Forwarding to runner at {base_url}/execute")
        print(f"Runner payload (truncated): {json.dumps(payload)[:800]}")
        exec_resp = requests.post(
            f"{base_url}/execute",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if exec_resp.headers.get("content-type", "").startswith("application/json"):
            exec_json = exec_resp.json()
        else:
            exec_json = {"stdout": exec_resp.text}
    except Exception as e:
        exec_json = {"error": "Failed to call executor-image API", "details": str(e), "Runner payload (truncated)": "{json.dumps(payload)[:800]}"}

    # stop the container
    try:
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, text=True, timeout=15)
    finally:
        Containers.map.pop(container_name, None)

    # return the results to the user
    return exec_json