import { Models } from 'node-appwrite';

export enum Collection {
  Threads = 'Threads',
  Assistants = 'Assistants',
}

export type Assistant = {
  name: string;
  assistantId: string;
  discordToken: string;
} & Models.Document;

export type Thread = {
  openAIThreadId: string;
  discordThreadId: string;
  assistantId: string;
} & Models.Document;
