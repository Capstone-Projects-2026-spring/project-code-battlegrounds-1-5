from typing import Optional, List, Tuple

from fastapi import FastAPI, status, Request
from fastapi.responses import PlainTextResponse
from google.cloud import compute_v1
from pydantic import BaseModel
from enum import Enum
from contextlib import asynccontextmanager
from fastapi_globals import GlobalsMiddleware
from starlette.responses import Response
import requests

# TODO: this can now create vms (but needs to make new image as it won't automatically update git repo - maybe add git commands to startup?).
# TODO: still need to have the request-warm-vm endpoint ping on subsequent requests until ready, as well as deleting vms

class Status(Enum):
    STARTING = 1
    READY= 2
    BUSY = 3
    KMS = 4
    ERROR = 5

PROJECT_ID = "code-battlegrounds"
MACHINE_IMAGE = "projects/code-battlegrounds/global/machineImages/executor-vm"
# valid zones
DEFAULT_ZONES = ["us-central1-a", "us-central1-b", "us-central1-c"]
DEPLOYED = False

class VMProvisioner:
    def __init__(self, project_id: str = PROJECT_ID, machine_image: str = MACHINE_IMAGE, zones: List[str] = DEFAULT_ZONES):
        self.project_id = project_id
        self.machine_image = machine_image
        self.zones = zones
        self.client = compute_v1.InstancesClient()

    def _extract_ip_from_instance(self, created) -> Optional[str]:
        if DEPLOYED:
            # get internal ip
            if not getattr(created, 'network_interfaces', None):
                return None

            for nic in created.network_interfaces:
                # internal ip
                internal_ip = getattr(nic, 'internal_ip', None)
                if internal_ip:
                    print("Got internal IP of {ip}".format(ip=internal_ip))
                    return internal_ip
            return None
        else:
            if getattr(created, 'network_interfaces', None):
                for nic in created.network_interfaces:
                    # external nat ip for testing, in prod we will use internal ip
                    if getattr(nic, 'access_configs', None):
                        for ac in nic.access_configs:
                            nat_ip = getattr(ac, 'nat_i_p', None) or getattr(ac, 'nat_ip', None)
                            if nat_ip:
                                print("Got external IP of {ip}".format(ip=nat_ip))
                                return nat_ip
            return None

    def fetch_ip(self, name: str, zone: str) -> Optional[str]:
        try:
            created = self.client.get(project=self.project_id, zone=zone, instance=name)
            ip = self._extract_ip_from_instance(created)
            if ip:
                return ip
        except Exception:
            print("Error fetching IP")
        return None

    def create_instance(self, name: str) -> Tuple[bool, Optional[str]]:
        # tries all zones and returns (True, ip) on first accepted creation, (False, None) if none accepted
        for zone in self.zones:
            try:
                instance = compute_v1.Instance()
                instance.name = name
                instance.source_machine_image = self.machine_image
                metadata = compute_v1.Metadata()
                metadata.items = [
                    {
                        "key":"startup-script",
                        "value":"#!/bin/bash\ncd /home/juli4fasick/project-code-battlegrounds-1-5\ngit pull\ncd ./code-executor\npip3"
                    }
                ]
                op = self.client.insert(
                    project=self.project_id,
                    zone=zone,
                    instance_resource=instance,
                )
                print(f"Instance creation requested for {name} in zone {zone}. Operation: {op.name if hasattr(op, 'name') else 'N/A'}")
                return True, zone
            except Exception as e:
                print(f"Unable to create instance {name} in zone {zone}: {e}")
                continue
        print("No zones accepted the instance creation request.")
        return False, None

class VM:
    def __init__(self, game_id):
        self.game_id = "{game_id}".format(game_id=game_id)
        self.ip = None
        self.zone = None
        self.status = Status.STARTING

class Pool: # we're gonna make a VM per game. based on my math, if a VM is 50$ a month, it will cost us a whopping .8 cents to keep a vm up per game
    def __init__(self, provisioner: VMProvisioner):
        self.games = {} # map gameid to vm
        self.provisioner = provisioner

    def scale(self, game_id: str): # create VM for this game if possible
        vm = VM(game_id)
        ok, zone = self.provisioner.create_instance(vm.game_id)
        if ok:
            vm.zone = zone
            print("VM created successfully in zone " + zone)
            self.games[game_id] = vm
            print(self.games.keys())
            return vm.game_id
        else:
            return None


@asynccontextmanager
async def lifespan(app: FastAPI): # ignore the warning here. mess with this line and everything breaks. you have been warned!
    # Initialize a single Pool/VMProvisioner for the lifetime of the app
    app.state.pool = Pool(VMProvisioner())
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(GlobalsMiddleware)

@app.get("/", response_class=PlainTextResponse)
def root():
    return "Whoever you are, if you\'re seeing this, you really shouldn\'t be here. No, seriously, how\'d you end up here?"

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
def request_warm_vm(payload: PrewarmRequest, req: Request):
    print("Requested warm VM for gameId " + payload.gameId)
    # app lifetime state pool, make sure it exists
    pool = getattr(req.app.state, "pool", None)
    if pool is None:
        req.app.state.pool = Pool(VMProvisioner())
        pool = req.app.state.pool
        print("Created Pool/VMProvisioner")
    # if vm is not made for this gameid yet, make it. otherwise, ping the vm on it's /health endpoint and see if it's ready.
    if payload.gameId in pool.games.keys():
        print("VM for game " + payload.gameId + " already made. Client pinging for status")
        vm = pool.games[payload.gameId]
        # try to fetch the ip if we don't have it yet
        if not vm.ip:
            vm.ip = pool.provisioner.fetch_ip(vm.game_id, vm.zone)
        # if we have an ip, ping the /health endpoint on port 8000
        if vm.ip:
            try:
                r = requests.get(f"http://{vm.ip}:8000/health", timeout=2)
                if r.status_code == 200:
                    vm.status = Status.READY
                    return Response(status_code=status.HTTP_200_OK)
                else:
                    # not healthy yet
                    return Response(status_code=status.HTTP_201_CREATED)
            except Exception as e:
                print(f"Health check failed for {vm.game_id} at {vm.ip}: {e}")
                return Response(status_code=status.HTTP_201_CREATED)
        # no ip means still spinning up
        return Response(status_code=status.HTTP_201_CREATED)
    chk = pool.scale(payload.gameId)
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