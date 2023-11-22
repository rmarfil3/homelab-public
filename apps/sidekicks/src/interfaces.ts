import EventEmitter from 'node:events';

import { Platform } from './schemas';
import { SupervisorCommand, UserMessage } from './types';

interface PlatformSidekickInterface extends EventEmitter {
  platform: Platform;
  start(): Promise<void>;
  sendTyping(userMessage: UserMessage): Promise<void>;
  reply(userMessage: UserMessage, reply: string): Promise<void>;
  shutdown(): Promise<void>;
}

interface PlatformSupervisorInterface extends EventEmitter {
  platform: Platform;
  start(): Promise<void>;
  reply(command: SupervisorCommand, reply: string): Promise<void>;
  shutdown(): Promise<void>;
}

export { PlatformSidekickInterface, PlatformSupervisorInterface };
