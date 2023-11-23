import { Models } from 'node-appwrite';

export enum DatabaseCollection {
  AllowedUsers = 'AllowedUsers',
  Threads = 'Threads',
  Assistants = 'Assistants',
}

export enum Platform {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
}

export type Assistant = {
  name: string;
  assistantId: string;
  discordToken: string;
  platform: Platform;
} & Models.Document;

export type Thread = {
  openAIThreadId: string;
  discordThreadId: string;
  assistantId: string;
} & Models.Document;

export type AllowedUser = {
  userId: string;
  platform: Platform;
} & Models.Document;
