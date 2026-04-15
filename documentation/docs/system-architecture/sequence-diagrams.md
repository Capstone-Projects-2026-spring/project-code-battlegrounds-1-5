# Sequence Diagrams

## Use Case 1 (Full Game Flow with Redis/websockets)
```plantuml-diagram
@startuml
title Game Flow

skinparam participantPadding 20
skinparam boxPadding 10
skinparam shadowing false
skinparam sequenceArrowThickness 1
skinparam maxMessageSize 120

actor "User A" as ua
actor "User B" as ub
participant API as api
participant "WebSocket Server" as ws
activate ws
participant "Code Runner" as runner
note left of runner
container is warm (always running)
end note
activate runner
participant Redis as rds
activate rds
participant PostgreSQL as pg
activate pg


note right of ws
The server uses the
socket.io Redis adapter
for pub/sub capabilities.
end note

== User Creates Match ==
activate ua
ua --> api: /rooms/create
activate api
api --> pg: Matches table entry, status set to waiting
api --> rds: Add match ID to Redis for matchmaking queue
api --> ua: Return match ID for client side redirect
ua --> ws: HTTP connection upgrade to socket

ws --> ua: socket ack
ua --> ws: emit joinGame
ws --> ua: emit roleAssigned (first connection is coder)
ws --> pg: add user to match with role

== User Joins Match ==
note right of api
These could be different
backends entirely
end note
ub --> api: /rooms/join
activate ub
api --> rds: Remove found match ID from Redis
api --> ub: Match ID of User A's room for client side redirect
ub --> ws: HTTP connection upgrade to socket
ws --> ub: socket ack
ub --> ws: emit joinGame
ws --> ub: emit roleAssigned (tester)
ws --> pg: update match record with game status in-progress and new player/role

== Game Start ==
ua --> ws: emit codeChanged
ws --> rds: persist code for rejoin or similar
ws --> ws: emit socket.to(roomID).emit('receiveCodeUpdate',code'): notify other backend of code change


== Test Case Added ==
ub --> ws: emit(testCaseAdded)
ws --> rds: persist test case as needed for rejoin/reconnect

== Test Case Submitted ==
ub --> ws: emit(submitTestCase)
ws --> runner: /execute
runner --> ws: test results
ws --> ub: emit(receiveTestResults)

== Chat Message Sent ==
ub --> ws: emit(sendChat)
ws --> rds: persist chat as needed for rejoin/reconnect
ws -> ws: emit(receiveChat)
ws --> ua: emit (receiveChat)

== Code Submitted ==
ub --> ws: emit(submit)
ws --> runner: /execute (supports multiple test cases)
runner --> ws: test results
ws --> ub: emit(receiveTestResults)

== Game Cleanup ==
ws --> pg: update match status as finished and add stats as needed
ws --> rds: clear match state
ws --> ua: disconnect
ws --> ub: disconnect
deactivate api
deactivate ws
deactivate ua
deactivate ub


@enduml
```

## Use Case 2 (Perfect Game Flow)
```plantuml-diagram
@startuml
title Use Case 2 (Perfect Game Flow)

skinparam participantPadding 20
skinparam boxPadding 10
skinparam shadowing false
skinparam sequenceArrowThickness 1
skinparam maxMessageSize 120

actor "User A" as ua
actor "User B" as ub
participant API as api
participant "WebSocket Server" as ws
activate ws
participant "Code Runner" as runner
note left of runner
container is warm (always running)
end note
activate runner
participant Redis as rds
activate rds
participant PostgreSQL as pg
activate pg


note right of ws
The server uses the
socket.io Redis adapter
for pub/sub capabilities.
end note

== User Creates Match ==
activate ua
ua --> api: /rooms/create
activate api
api --> pg: Matches table entry, status set to waiting
api --> rds: Add match ID to Redis for matchmaking queue
api --> ua: Return match ID for client side redirect
ua --> ws: HTTP connection upgrade to socket

ws --> ua: socket ack
ua --> ws: emit joinGame
ws --> ua: emit roleAssigned (first connection is coder)
ws --> pg: add user to match with role

== User Joins Match ==
note right of api
These could be different
backends entirely
end note
ub --> api: /rooms/join
activate ub
api --> rds: Remove found match ID from Redis
api --> ub: Match ID of User A's room for client side redirect
ub --> ws: HTTP connection upgrade to socket
ws --> ub: socket ack
ub --> ws: emit joinGame
ws --> ub: emit roleAssigned (tester)
ws --> pg: update match record with game status in-progress and new player/role

== Game Play ==
ua --> ws: emit codeChanged
ws --> rds: persist code for rejoin or similar
ws --> ws: emit socket.to(roomID).emit('receiveCodeUpdate',code'): notify other backend of code change
ws --> ub: emit(receiveCodeUpdate)

ub --> ws: emit(submitTestCase)
ws --> runner: /execute
runner --> ws: test results
ws --> ub: emit(receiveTestResults)
note right of ub
All tests are passing!

== Code Submitted for Scoring ==
ub --> ws: emit(submit)
note right of ub
Game ends before role-swap timer.
end note
ws --> runner: /execute (with all official test cases)
runner --> ws: final score and results
ws --> ub: emit(receiveTestResults)

== Game Cleanup ==
ws --> pg: update match status as finished and add stats
ws --> rds: clear match state
ws --> ua: disconnect
ws --> ub: disconnect
deactivate api
deactivate ws
deactivate ua
deactivate ub


@enduml
```

## Use Case 3 (Worst-Case Game Flow)
```plantuml-diagram
@startuml
title Use Case 3 (Worst-Case Game Flow)

skinparam participantPadding 20
skinparam boxPadding 10
skinparam shadowing false
skinparam sequenceArrowThickness 1
skinparam maxMessageSize 120

actor "User A" as ua
actor "User B" as ub
participant API as api
participant "WebSocket Server" as ws
activate ws
participant "Code Runner" as runner
note left of runner
container is warm (always running)
end note
activate runner
participant Redis as rds
activate rds
participant PostgreSQL as pg
activate pg
participant "Expiration Listener" as el
activate el


note right of ws
The server uses the
socket.io Redis adapter
for pub/sub capabilities.
end note

== User Creates & Joins Match ==
ua -> api: Create Match
api -> pg: Create Match record
api -> rds: Add to matchmaking queue
api -> ua: Match ID
ua -> ws: Join Game as Coder

ub -> api: Join Match
api -> rds: Find & Remove from queue
api -> ub: Match ID
ub -> ws: Join Game as Tester
ws -> pg: Update match status to 'in-progress'
ws -> rds: SET game:{id}:expires '1' PX DURATION

== Game Play (First Half) ==
ua --> ws: emit codeChanged
ws --> rds: persist code
ws --> ub: emit(receiveCodeUpdate)

ub --> ws: emit(submitTestCase)
ws --> runner: /execute
runner --> ws: test results (failing)
ws --> ub: emit(receiveTestResults)

== Role Switch (Mid-game) ==
note over ua, ub
Halfway through the match, roles are swapped.
User A is now the Tester, User B is the Coder.
end note
ws --> ua: emit roleAssigned (tester)
ws --> ub: emit roleAssigned (coder)

== Game Play (Second Half) ==
ub --> ws: emit codeChanged
ws --> rds: persist code
ws --> ua: emit(receiveCodeUpdate)

ua --> ws: emit(submitTestCase)
ws --> runner: /execute
runner --> ws: test results (still failing)
ws --> ua: emit(receiveTestResults)

== Timer Runs Out ==
el -> rds: SUBSCRIBE to key expirations
rds -> el: event: game:{id}:expires expired
el -> ws: notify game end for game {id}
ws -> ws: emit socket.to(roomID).emit('gameEnded')
note right of ws
Server triggers auto-submission with penalties.
end note
ws --> runner: /execute (auto-submit with current code)
runner --> ws: final (failing) results
ws --> pg: update match status (finished, timed out) and add stats with penalties

== Game Cleanup ==
ws --> rds: clear match state
ws --> ua: disconnect
ws --> ub: disconnect
deactivate api
deactivate ws
deactivate ua
deactivate ub
deactivate el

@enduml
```

## Use Case 4 (Default Matchmaking)
![alt text](res/use-case-3.png)

## Use Case 5 (Party Matchmaking)
![alt text](res/use-case-4.png)

## Use Case 6 (Account Creation)
![alt text](res/use-case-1.png)

## Use Case 7 (Signing In)
![alt text](res/use-case-2.png)
