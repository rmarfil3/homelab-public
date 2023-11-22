import { SupervisorCommandCode } from './enums';

export type User = {
  displayName?: string;
  id?: string;
  username: string;
};

export type UserMessage<OriginalPlatformMessage = unknown> = {
  assistantId: string;
  content: string;
  originalPlatformMessage: OriginalPlatformMessage;
  platformThreadId: string;
  user: User;
};

export type SupervisorCommand<
  OriginalPlatformCommand = unknown,
  CommandData = Record<string, string>,
> = {
  commandCode: SupervisorCommandCode;
  originalPlatformCommand: OriginalPlatformCommand;
  user: User;
  data?: CommandData;
};
