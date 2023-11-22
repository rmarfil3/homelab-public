import EventEmitter from 'node:events';

import { UserMessage } from './types';

interface PlatformInterface extends EventEmitter {
  start(): Promise<void>;
  sendTyping(userMessage: UserMessage): Promise<void>;
  reply(userMessage: UserMessage, reply: string): Promise<void>;
  shutdown(): Promise<void>;
}

export { PlatformInterface };
