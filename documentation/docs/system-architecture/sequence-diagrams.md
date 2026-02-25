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
title WebSocket + Redis State Flow

skinparam participantPadding 20
skinparam boxPadding 10
skinparam shadowing false
skinparam sequenceArrowThickness 1
skinparam maxMessageSize 120

actor User as U
participant "PlayGame page" as Page
participant "Socket.IO Client" as Client
participant "server.js" as Server
participant "Socket.IO Server" as IOServer
queue "Redis Adapter\n(pub/sub channels)" as RedisAdapter
database "Redis\nkeys: game:<id>:code" as RedisKV

U -> Page: Navigate to /playGame/{gameID}
activate Page
Page -> Client: io() initializes WS connection via useEffect
activate Client
Client -> Server: HTTP Upgrade → WebSocket
activate Server
Server -> IOServer: Attach connection (io.on('connection'))
activate IOServer
IOServer -> Client: connection ack

== Join Room and Role Assignment ==
Client -> IOServer: emit('joinGame', gameId)
IOServer -> IOServer: socket.join(gameId)
IOServer -> IOServer: allSockets() in room
IOServer -> Client: emit('roleAssigned', role)
note right of IOServer
Role logic in server.js:
- 1st in room → coder
- 2nd in room → tester
- others → spectator
end note

== Sync latest code on join ==
IOServer -> RedisKV: GET game:{gameId}:code
RedisKV --> IOServer: latestCode
IOServer -> Client: emit('receiveCodeUpdate', latestCode)


== Live Coding: coder updates code ==
Client -> IOServer: emit('codeChange', { roomId, code })
IOServer -> RedisKV: SET game:{roomId}:code = code
note right of RedisKV
Persists latest code so any backend/late joiners in cluster can read it.
end note

' broadcast to others in same room (except sender)
IOServer -> IOServer: socket.to(roomId).emit('receiveCodeUpdate', code)
IOServer -> RedisAdapter: publish room event
RedisAdapter --> IOServer: deliver changes to subscribers on other backends
IOServer -> Client: receiveCodeUpdate (to peers in room)

== Chat messages (room scoped) ==
Client -> IOServer: emit('sendChat', { roomId, message })
IOServer -> IOServer: socket.to(roomId).emit('receiveChat', message)
IOServer -> RedisAdapter: publish room event for cluster fan-out
RedisAdapter --> IOServer: relay to other instances' clients

note right of RedisAdapter
Note that currently messages are not explicitly set in Redis.
This means that if a client joins late or recconects, chat messages
will not persist or be reloaded.
end note

== Disconnect ==
Client -> IOServer: disconnect
IOServer -> Server: 'disconnect' handler logs socket.id

deactivate IOServer
deactivate Server
Client --> Page: socketInstance.disconnect() on unmount
deactivate Client
Page --> U: Render role-specific UI (CoderPOV/TesterPOV) or Spectator message
deactivate Page

@enduml

```

```plantuml-digram
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
participant Redis as rds
participant PostgreSQL as pg


note right of ws
The server uses the
socket.io Redis adapter
for pub/sub capabilities.
end note

== User Creates Match ==

ua --> api: /rooms/create
activate api
api --> api: /rooms/join: see if there are open rooms to join instead of create
api --> pg: Matches table entry, status set to waiting
activate pg
api --> rds: Add match ID to Redis for matchmaking queue
activate rds
api --> ua: Return match ID for client side redirect
ua --> ws: HTTP connection upgrade to socket
activate ws
ws --> ua: socket ack
ua --> ws: emit joinGame
ws --> ua: emit roleAssigned
ws --> pg: add user to match with role
deactivate api
deactivate ws

== User Joins Match ==
ub --> api: /rooms/create
activate api
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
deactivate api
deactivate ws

== Game Start ==
ua --> ws: emit codeChanged
ws --> rds: persist code for rejoin or similar
ws --> ws: emit socket.to(roomID).emit('receiveCodeUpdate',code'): notify other backend of code change
ws --> ub: emit(receiveCodeUpdate, code)

` TODO: add testcase added, testcase ran, code submitted
@enduml
```