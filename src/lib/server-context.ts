import type { IncomingMessage } from 'http';
import type { Server } from 'socket.io';

export function getIO(req: IncomingMessage) {
    return (req.socket as any)?.server?._io as Server | undefined;
}

export function getRedis(req: IncomingMessage) {
    return (req.socket as any)?.server?._redis;
}