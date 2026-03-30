from datetime import datetime, timedelta, UTC
from typing import Optional, List

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse, PlainTextResponse
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

class VM:
    def __init__(self, game_id):
        self.game_id = game_id
        self.ip = None
        self.status = Status.STARTING

class Pool(): # we're gonna make a VM per game. based on my math, if a VM is 50$ a month, it will cost us a whopping .8 cents to keep a vm up per game
    def __init__(self):
        self.games = {}

    def scale(self, game_id: str): # TODO: not yet implemented
        self.games[game_id] = VM(game_id)

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

@app.post("/request-warm-vm", response_class=Response)
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
    g.p.scale(request.gameId)
    return Response(status_code=status.HTTP_201_CREATED)

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
