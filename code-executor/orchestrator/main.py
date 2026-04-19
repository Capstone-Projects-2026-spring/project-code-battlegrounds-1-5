import json
from typing import Tuple

from fastapi import FastAPI, status, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from google.api_core.exceptions import NotFound
from google.cloud import compute_v1
from enum import Enum
from contextlib import asynccontextmanager
from starlette.responses import Response
import requests

from models import *

# TODO: when cloud run deployment is working and i've switched over to internal, i need to tighten the firewall. run:
# gcloud compute firewall-rules create allow-fastapi-8000 \
# --network=default \
# --allow=tcp:8000 \
#   --source-ranges=10.8.0.0/28   # your VPC connector
#   --target-tags=fastapi-server

class Status(Enum):
    STARTING = 1
    READY= 2
    BUSY = 3
    KMS = 4
    ERROR = 5

PROJECT_ID = "code-battlegrounds"
MACHINE_IMAGE = "projects/code-battlegrounds/global/machineImages/executor-vm-v2"
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

    def delete_instance(self, name: str, zone: str):
        try:
            self.client.delete(
                project=self.project_id,
                zone=zone,
                instance=name,
            )
        except NotFound:
            # actually chill - it was prob already deleted but just somehow wasnt in state. maybe a scaling issue (NONE of this is backed by redis lol)
            pass
        except Exception as e:
            msg = "Error deleting instance {name}: {e}".format(name=name,e=e)
            print(msg)
            return msg

    def create_instance(self, name: str) -> Tuple[bool, Optional[str]]:
        # tries all zones and returns (True, ip) on first accepted creation, (False, None) if none accepted
        for zone in self.zones:
            try:
                instance = compute_v1.Instance()
                instance.name = name
                instance.source_machine_image = self.machine_image
                instance.tags = compute_v1.Tags(items=["fastapi-server"])
                # we have to manually create the network interface otherwise it wont get picked up by our firewall rule. will need to test, but should be ok to remove the nat section or maybe even this whole interface definition when we deploy to cloud run (as we will only be using internal ips)
                network_interface = compute_v1.NetworkInterface()
                network_interface.network = f"projects/{self.project_id}/global/networks/default"

                # this bit actually gives us the nat
                access_config = compute_v1.AccessConfig()
                access_config.name = "External NAT"
                access_config.type_ = "ONE_TO_ONE_NAT"
                access_config.network_tier = "PREMIUM"
                network_interface.access_configs = [access_config]

                instance.network_interfaces = [network_interface]
                metadata = compute_v1.Metadata()
                metadata.items = [
                    {
                        # TODO: get source in startup script outta here and refer directly to location of python executable in venv
                        "key":"startup-script", # TODO: MUST REMOVE THIS GIT SWITCH AS WE MERGE. vm is already on main. while i test, i want to be on my branch
                        "value":"#!/bin/bash\ngit config --system --add safe.directory /home/juli4fasick/project-code-battlegrounds-1-5\ncd /home/juli4fasick/project-code-battlegrounds-1-5\ngit switch feat/execution-in-prod\ngit pull\nsource ./.venv/bin/activate\ncd ./code-executor\npip3 install -r requirements.txt\ncd ./executor-api\nfastapi run --host 0.0.0.0 --port 8000",
                    }
                ]
                instance.metadata = metadata
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

    def delete(self, game_id: str):
        if game_id not in self.games:
            return "Game {game_id} not found. Either it was never created, is still being created, was already deleted, or is a skill issue one the programmer's end.".format(game_id=game_id)
        game = self.games[game_id]
        chk = self.provisioner.delete_instance(game.game_id, game.zone)
        if chk is not None:
            return chk
        self.games.pop(game_id)
        return None

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

class DeleteVMRequest(BaseModel):
    gameId: str
@app.post("/delete-vm", response_class=Response, responses={
    200: {"description": "VM queued for deletion."},
})
def delete_vm(payload: DeleteVMRequest, request: Request):
    pool = request.app.state.pool
    print("Deletion requested for gameId: " + payload.gameId)
    chk = pool.delete(payload.gameId)
    if chk is not None:
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"error": chk})
    else:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"success": "vm queued for deletion"})

@app.post("/execute") # TODO: need to include a gameid endpoint here of which vm to target before falling back. this is already mirrored in executor-image.
def execute(req: ExecutionRequest, request: Request):
    print(json.dumps(req.dict()))

    # Use the application-level pool to find a READY VM with a reachable executor-api
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        request.app.state.pool = Pool(VMProvisioner())
        pool = request.app.state.pool

    # Helper to probe a VM, ensure IP and health
    def ensure_vm_ready(vm: VM) -> Optional[str]:
        # obtain IP if missing
        if not vm.ip:
            vm.ip = pool.provisioner.fetch_ip(vm.game_id, vm.zone)
        if not vm.ip:
            return None
        # health check
        try:
            r = requests.get(f"http://{vm.ip}:8000/health", timeout=2)
            if r.status_code == 200:
                vm.status = Status.READY
                return vm.ip
        except Exception:
            pass
        return None

    # Try any existing VM first
    target_ip = None
    for vm in pool.games.values():
        target_ip = ensure_vm_ready(vm)
        if target_ip:
            break

    if not target_ip:
        # No existing VM is ready. For minimal change, do not auto-provision here; instruct caller to prewarm.
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    # Forward the execute request to the executor-api running on the VM
    # payload = json.dumps(req.dict())
    try:
        # Ensure we serialize the Pydantic model correctly (supports v1 and v2)
        payload = req.model_dump(mode='json') if hasattr(req, 'model_dump') else req.dict()
        if isinstance(payload["testCases"], str):
            payload["testCases"] = json.loads(payload["testCases"])

        if isinstance(payload["runIDs"], str):
            payload["runIDs"] = json.loads(payload["runIDs"])
        print(f"Forwarding /execute to http://{target_ip}:8000/execute")
        print(f"Payload (truncated): {json.dumps(payload)[:800]}")
        resp = requests.post(
            f"http://{target_ip}:8000/execute",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60,
        )
        print(f"Executor API response {resp.status_code}: {resp.text[:800]}")
        # mirror status code and response
        content_type = resp.headers.get("content-type", "")
        if content_type.startswith("application/json"):
            return Response(content=resp.text, media_type="application/json", status_code=resp.status_code)
        else:
            return PlainTextResponse(content=resp.text, status_code=resp.status_code)
    except Exception as e:
        print(f"Error calling executor API at {target_ip}: {e}")
        return PlainTextResponse(content=f"Failed to reach executor API: {e}", status_code=status.HTTP_502_BAD_GATEWAY)