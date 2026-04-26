import type { Socket } from 'socket.io';

export type SocketWithState = Socket & {
  userId?: string;
  teamId?: string;
  gameId?: string;
};

export type ParameterPrimitive =
  | 'string'
  | 'number'
  | 'array_string'
  | 'array_number'
  | 'array_array_string'
  | 'array_array_number'
  | 'boolean';

export interface Parameter {
  name: string;
  type: ParameterPrimitive;
  value: string | null;
  isOutputParameter?: boolean;
}

export interface TestableCase {
  id: number;
  functionInput: Parameter[];
  expectedOutput: Parameter;
  computedOutput?: string | null;
}

export interface ChatMessage {
  id: string;
  text: string;
  userName: string;
  timestamp: number;
}