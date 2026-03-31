from datetime import datetime, timedelta, UTC
from typing import Optional, List

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse, PlainTextResponse
from google.cloud import compute_v1
from pydantic import BaseModel
from enum import Enum
from contextlib import asynccontextmanager
from fastapi_globals import g, GlobalsMiddleware
from starlette.responses import Response


class Status(Enum):
    STARTING = 1
    READY= 2
    BUSY = 3
    KMS = 4
    ERROR = 5

PROJECT_ID = "code-battlegrounds"
MACHINE_IMAGE = "projects/code-battlegrounds/global/machineImages/executor-vm"
ZONES = ["us-central-a", "us-central-b", "us-central-c", "us-central-d"]

class VM:
    def _create(self):
        client = compute_v1.InstancesClient()

        for zone in ZONES:
            try:
                instance = compute_v1.Instance()
                instance.name = self.game_id
                instance.source_machine_image = MACHINE_IMAGE

                op = client.insert(
                    project=PROJECT_ID,
                    zone=zone,
                    instance_resource=instance,
                )
                print("instance created in zone {}".format(zone))
                return op
            except Exception as e:
                print("Unable to create instance in zone {}".format(zone))

        print("No instances available!") # TODO: getting this every time. why?
        return None

    def __init__(self, game_id):
        self.game_id = "game-{game_id}".format(game_id=game_id)
        self.ip = None
        self.status = Status.STARTING
        self._create()

class Pool: # we're gonna make a VM per game. based on my math, if a VM is 50$ a month, it will cost us a whopping .8 cents to keep a vm up per game
    def __init__(self):
        self.games = {}

    def scale(self, game_id: str): # TODO: not yet implemented
        t = VM(game_id)
        if t is not None:
            self.games[game_id] = VM(game_id)
            return t.game_id
        else:
            return None


@asynccontextmanager
async def lifespan(app: FastAPI): # ignore the warning here. mess with this line and everything breaks. you have been warned!
    g.p = Pool()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(GlobalsMiddleware)

@app.get("/", response_class=PlainTextResponse)
def root():
    return "Whoever you are, if you\'re seeing this, you really shouldn\'t be here. No, seriously, how'd you end up here?"

@app.get("/health", response_class=Response)
def health():
    return Response(status_code=status.HTTP_200_OK)

class PrewarmRequest(BaseModel):
    gameId: str

@app.post("/request-warm-vm", response_class=Response, responses={
    200: {"description": "Warm VM has been requested and is ready"},
    201: {"description": "Warm VM creation requested"},
    503: {"description": "VM not available in any region! Try again later."}
})
def request_warm_vm(request: PrewarmRequest):
    print("Requested warm VM for gameId " + request.gameId)
    # sometimes the lifecycle shit is weird so check manually too
    if not hasattr(g, 'p') or g.p is None:
        g.p = Pool()
    # if vm is not made for this gameid yet, make it. otherwise, ping the vm on it's /health endpoint and see if it's ready.
    if request.gameId in g.p.games:
        print("VM for game " + request.gameId + " already made. Client pinging for status")
        # TODO: if ip != none, ping /health on port 8000 and update status with findings and return
        return Response(status_code=status.HTTP_201_CREATED)
        # return Response(status_code=status.HTTP_200_OK)
    chk = g.p.scale(request.gameId)
    if chk is not None:
        return Response(status_code=status.HTTP_201_CREATED)
    else:
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

class TestCase(BaseModel):
    input: str
    expected: Optional[str] = None

class ExecutionRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = ""
    testCases: Optional[List[TestCase]] = None

# @app.post("/execute")
# def execute(req: ExecutionRequest):
