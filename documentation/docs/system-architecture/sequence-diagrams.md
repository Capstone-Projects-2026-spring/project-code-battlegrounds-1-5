# Sequence Diagrams

## Use Case 1 (Account Creation)
![alt text](res/use-case-1.png)

## Use Case 2 (Signing In)
![alt text](res/use-case-2.png)

## Use Case 3 (Default Matchmaking)
![alt text](res/use-case-3.png)

## Use Case 4 (Party Matchmaking)
![alt text](res/use-case-4.png)

## Use Case 5 (Full Game Flow with Redis/websockets)
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
participant "Runner Container" as runner
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
api --> api: /rooms/join: see if there are open rooms to join instead of create
api --> pg: Matches table entry, status set to waiting
api --> rds: Add match ID to Redis for matchmaking queue
activate ub
api --> ua: Return match ID for client side redirect
ua --> ws: HTTP connection upgrade to socket
activate ws
ws --> ua: socket ack
ua --> ws: emit joinGame
ws --> ua: emit roleAssigned
ws --> pg: add user to match with role

== User Joins Match ==
ub --> api: /rooms/create
note right of api
These could be different
backends entirely
end note
api --> api: /rooms/join
api --> rds: Remove found match ID from Redis
api --> ub: Match ID of User A's room for client side redirect
ub --> ws: HTTP connection upgrade to socket
ws --> ub: socket ack
ub --> ws: emit joinGame
ws --> ub: emit roleAssigned
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