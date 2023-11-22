import { AppwriteSingleton, OpenAIService } from '@homelab/services';
import { createLogger, sleep } from '@homelab/utils';
import { Databases, ID, Query } from 'node-appwrite';
import OpenAI from 'openai';
import { Run } from 'openai/resources/beta/threads';
import { Logger } from 'winston';

import { DATABASE } from './constants';
import { PlatformEvent, RunStatus } from './enums';
import { PlatformInterface } from './interfaces';
import { DatabaseCollection, Thread } from './schemas';
import { UserMessage } from './types';

class Sidekick {
  private readonly name: string;
  private readonly assistantId: string;
  private databases: Databases;
  private openAI: OpenAI;
  private logger: Logger;
  private platform: PlatformInterface;

  constructor(
    name: string,
    assistantId: string,
    platform: PlatformInterface,
  ) {
    this.name = name;
    this.assistantId = assistantId;
    this.platform = platform;
    this.databases = new Databases(AppwriteSingleton.getInstance());
    this.openAI = OpenAIService.getInstance();
    this.logger = createLogger(this.name);

    this.platform.on(PlatformEvent.READY, this.onReady.bind(this));
    this.platform.on(
      PlatformEvent.MESSAGE,
      this.onMessage.bind(this),
    );
  }

  async start() {
    await this.platform.start();
  }

  onReady() {
    this.logger.info('I am ready to serve!');
  }

  async onMessage(message: UserMessage) {
    let thread = await this.getThread(message.platformThreadId);
    if (!thread) {
      thread = await this.createThread(message.platformThreadId);
    }

    await this.addMessageToThread(thread, message.content);
    const run = await this.runThread(thread);

    try {
      await this.waitForRunResponse(thread, run, message);
    } catch (error) {
      this.logger.error(`Thread run failed. Status: ${error}`);
      return;
    }

    const reply = await this.getBotReply(thread);
    await this.platform.reply(message, reply);
  }

  async getThread(discordThreadId: string) {
    const threadResult = await this.databases.listDocuments<Thread>(
      DATABASE,
      DatabaseCollection.Threads,
      [Query.equal('discordThreadId', discordThreadId)],
    );

    return threadResult.documents[0];
  }

  async createThread(platformThreadId: string) {
    const openAIThread = await this.openAI.beta.threads.create();

    return this.databases.createDocument<Thread>(
      DATABASE,
      DatabaseCollection.Threads,
      ID.unique(),
      {
        discordThreadId: platformThreadId,
        openAIThreadId: openAIThread.id,
        assistantId: this.assistantId,
      } as Thread,
    );
  }

  async addMessageToThread(thread: Thread, content: string) {
    return this.openAI.beta.threads.messages.create(
      thread.openAIThreadId,
      { content, role: 'user' },
    );
  }

  async runThread(thread: Thread) {
    return this.openAI.beta.threads.runs.create(
      thread.openAIThreadId,
      { assistant_id: this.assistantId },
    );
  }

  async waitForRunResponse(
    thread: Thread,
    run: Run,
    message: UserMessage,
  ) {
    return new Promise((resolve, reject) => {
      (async () => {
        await this.platform.sendTyping(message);

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const thisRun =
            await OpenAIService.getInstance().beta.threads.runs.retrieve(
              thread.openAIThreadId,
              run.id,
            );

          if (thisRun.status === RunStatus.COMPLETED) {
            resolve(thisRun.status);
            return;
          } else if (
            [
              RunStatus.CANCELLED,
              RunStatus.FAILED,
              RunStatus.EXPIRED,
            ].includes(thisRun.status as RunStatus)
          ) {
            reject(thisRun.status);
            return;
          }

          await sleep(1000);
          await this.platform.sendTyping(message);
        }
      })();
    });
  }

  async getBotReply(thread: Thread) {
    const messages = await this.openAI.beta.threads.messages.list(
      thread.openAIThreadId,
    );
    const response = messages.data[0].content[0];

    if (response.type === 'text') {
      return response.text.value;
    }

    return '(response is an image)';
  }

  async logout() {
    return this.platform.shutdown();
  }
}

export default Sidekick;
