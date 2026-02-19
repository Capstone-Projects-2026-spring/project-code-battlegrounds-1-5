```mermaidjs


sequenceDiagram
    autonumber
    actor Coder as Browser A (First User)
    participant Server as Custom Server (Node.js + Socket.IO)
    actor Tester as Browser B (Second User)

    Note over Coder, Server: User navigates to /playGame/624
    
    Coder->>Server: Connect & Join Room (socket.emit('joinGame', '624'))
    activate Server
    Note right of Server: Logic Check: Server looks at room '624'. It's empty.
    Server-->>Coder: Assign 'Coder' Role (socket.emit('roleAssigned', 'coder'))
    deactivate Server
    Note left of Coder: page.tsx sets state to 'coder' and renders <CoderPOV />

    Note over Tester, Server: A second user navigates to the exact same URL.

    Tester->>Server: Connect & Join Room (socket.emit('joinGame', '624'))
    activate Server
    Note right of Server: Logic Check: Server looks at room '624'. It has 1 person.
    Server-->>Tester: Assign 'Tester' Role (socket.emit('roleAssigned', 'tester'))
    deactivate Server
    Note right of Tester: page.tsx sets state to 'tester' and renders <TesterPOV />

    == Phase 2: The Real-time Code Relay ==

    Note left of Coder: Coder types: "function start() { ... }"

    Coder->>Server: Send Keypress Data (socket.emit('codeChange', ...))
    activate Server
    Note right of Server: Megaphone Logic: Broadcast to everyone EXCEPT the sender.
    Server-->>Tester: Relay Code to Room (socket.to('624').emit(...))
    deactivate Server
    Note right of Tester: useEffect hook hears this, updates state, and Monaco re-renders.
```