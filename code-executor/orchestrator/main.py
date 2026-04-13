from typing import Optional, List

from fastapi import FastAPI, status
from fastapi.responses import JSONResponse, PlainTextResponse
from google.cloud import compute_v1
from pydantic import BaseModel
from enum import Enum
from contextlib import asynccontextmanager
from fastapi_globals import g, GlobalsMiddleware
from starlette.responses import Response

# TODO: this can now create vms. still need to have the request-warm-vm endpoint ping on subsequent requests until ready, as well as deleting vms

class Status(Enum):
    STARTING = 1
    READY= 2
    BUSY = 3
    KMS = 4
    ERROR = 5

PROJECT_ID = "code-battlegrounds"
MACHINE_IMAGE = "projects/code-battlegrounds/global/machineImages/executor-vm"
# Valid default zones for us-central1; can be overridden by ORCH_GCP_ZONES env var (comma-separated)
DEFAULT_ZONES = ["us-central1-a", "us-central1-b", "us-central1-c", "us-central1-d"]

class VMProvisioner:
    def __init__(self, project_id: str = PROJECT_ID, machine_image: str = MACHINE_IMAGE, zones: List[str] = DEFAULT_ZONES):
        self.project_id = project_id
        self.machine_image = machine_image
        self.zones = zones
        self.client = compute_v1.InstancesClient()

    def create_instance(self, name: str) -> bool:
        # tries all zones and returns True on first accepted creation, False if none accepted
        for zone in self.zones:
            try:
                instance = compute_v1.Instance()
                instance.name = name
                instance.source_machine_image = self.machine_image
                op = self.client.insert(
                    project=self.project_id,
                    zone=zone,
                    instance_resource=instance,
                )
                print(f"Instance creation requested for {name} in zone {zone}. Operation: {op.name if hasattr(op, 'name') else 'N/A'}")
                return True
            except Exception as e:
                print(f"Unable to create instance {name} in zone {zone}: {e}")
                continue
        print("No zones accepted the instance creation request.")
        return False

class VM:
    def __init__(self, game_id):
        self.game_id = "game-{game_id}".format(game_id=game_id)
        self.ip = None
        self.status = Status.STARTING

class Pool: # we're gonna make a VM per game. based on my math, if a VM is 50$ a month, it will cost us a whopping .8 cents to keep a vm up per game
    def __init__(self, provisioner: VMProvisioner):
        self.games = {}
        self.provisioner = provisioner

    def scale(self, game_id: str): # create VM for this game if possible
        vm = VM(game_id)
        ok = self.provisioner.create_instance(vm.game_id)
        if ok:
            self.games[game_id] = vm
            return vm.game_id
        else:
            return None


@asynccontextmanager
async def lifespan(app: FastAPI): # ignore the warning here. mess with this line and everything breaks. you have been warned!
    g.p = Pool(VMProvisioner())
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
        g.p = Pool(VMProvisioner())
    # if vm is not made for this gameid yet, make it. otherwise, ping the vm on it's /health endpoint and see if it's ready.
    if request.gameId in g.p.games:
        print("VM for game " + request.gameId + " already made. Client pinging for status")
        # TODO: if ip != none, ping /health on port 8000 and update status with findings and return
        return Response(status_code=status.HTTP_200_OK)
    chk = g.p.scale(request.gameId)
    if chk is not None:
        return Response(status_code=status.HTTP_201_CREATED) # created but not ready
    else:
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE) # cant create in instances

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