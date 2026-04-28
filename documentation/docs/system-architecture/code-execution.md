# Code Execution

## Local Execution
Locally, we have a small Docker container that runs with SYS_ADMIN and unconfined seccomp. They need the special permissions to run nsjail, which is essentially a container in itself, and thus must have access to the same linux namespace and cgroup primitives in the container as on the host.
We just use this container for every execution request for development - no other security methods are implemented are even necessary simply for development.

## Production Execution
Even with the rootjail, it's not enough for security. Reusing the containers is fine locally, but should not be done in production. Realistically, the attack surface is small enough that this *shouldn't* cause too much of an issue (especially as the executor should never be exposed, so all execution requests must go through our app and be subject to authentication and other requirements), but I would heavily recommend another layer of abstraction on top.

In GCP, we use VMs for this. The orchestrator takes a warm request and makes a VM as needed. Then that VM spins up instances of the Docker container for each execution request. It adds a little bit of overhead, but it's pretty minimal. The idea of this is that we can run the orchestrator in a Cloud Run Service such that when all VMs are destroyed and not in use, the service can scale to zero.

Future improvements for this include:
- Maintaining VM state in Redis so that the service can scale (right now, it is set to max of one instance).
- VM's should not be established per game. We did this as a quick way to get things working. We would prefer to keep a steady pool (say, one VM for every X concurrent games, not sure what the best formula should be) and route dynamically to the most readily available VM.
- The biggest issue for this right now is the cold start. The VMs all take about 45 seconds to come up, and if the user tries to submit code before that it simply will not run and will be lost to ether. This is best guarded against in the app.

## Prod Execution Flow
```plantuml-diagram
@startuml
title Production Execution Flow

skinparam participantPadding 20
skinparam boxPadding 10
skinparam shadowing false
skinparam sequenceArrowThickness 1
skinparam maxMessageSize 120

participant client as c
participant orchestrator as o
participant "executor-api (VM)" as ea
participant "executor-image (Docker container)" as ei
activate c
c -> o: request-warm-vm
activate o
o -> o: pool.scale(gameId)
o -> c: 201 on create, 200 on ready for execution request
==Execution Requests During Game==
c -> o: /execute
activate ea
o -> ea: /execute req sent to vm gameId
ea -> ea: create docker container
activate ei
ea -> ei: /execute
ei -> ei: format args
ei -> ei: write code + print statements with formatted args to file
ei -> ei: nsjail pivot and run file
ei -> ei: parse results from stdout and comapare against formatted expected results
ei -> ea: result
ea -> ea: delete docker container
deactivate ei
ea -> o: result
o -> c: result
==Game Finished==
c -> o: /delete-vm
o -> o: pool.delete(gameId)
deactivate ea
@enduml
```