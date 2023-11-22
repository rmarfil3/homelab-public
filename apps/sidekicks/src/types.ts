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
