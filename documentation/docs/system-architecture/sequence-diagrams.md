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