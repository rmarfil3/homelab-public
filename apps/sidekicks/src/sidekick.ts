import { AppwriteSingleton, OpenAIService } from '@homelab/services';
import {
  createLogger,
  generateTitle,
  logger,
  sleep,
} from '@homelab/utils';
import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  TextBasedChannel,
} from 'discord.js';
import { Databases, ID, Query } from 'node-appwrite';
import OpenAI from 'openai';
import { Run } from 'openai/resources/beta/threads';
import { Logger } from 'winston';

import {
  AUTO_THREAD_ARCHIVE_IN_MINUTES,
  DATABASE,
} from './constants';
import { RunStatus } from './enums';
import { DatabaseCollection, Thread } from './schemas';

class Sidekick {
  private name: string;
  private assistantId: string;
  private discordToken: string;
  private client: Client;
  private databases: Databases;
  private openAI: OpenAI;
  private logger: Logger;

  constructor(
    name: string,
    assistantId: string,
    discordToken: string,
  ) {
    this.name = name;
    this.assistantId = assistantId;
    this.discordToken = discordToken;
    this.databases = new Databases(AppwriteSingleton.getInstance());
    this.openAI = OpenAIService.getInstance();
    this.logger = createLogger(this.name);

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  async start() {
    await this.client.login(this.discordToken);
    this.client.on(Events.ClientReady, this.onReady.bind(this));
    this.client.on(
      Events.MessageCreate,
      this.onMessageCreate.bind(this),
    );
  }

  private log(level: keyof typeof logger, message: unknown) {
    logger[level](`${this.name}: ${message}`);
  }

  onReady() {
    this.logger.info('Bot is ready to serve!');
  }

  async onMessageCreate(message: Message) {
    if (message.author.bot || message.system) {
      return;
    }

    if (message.channel.isThread()) {
      await this.continueConversation(message);
    } else {
      await this.startNewConversation(message);
    }
  }

  private async startNewConversation(message: Message) {
    if (!this.isForMe(message)) {
      return;
    }

    this.logger.info(
      `(${message.author.displayName}) ${message.content.substring(
        0,
        50,
      )}...`,
    );

    this.logger.info('Starting new thread for this message...');

    const channelThread = await this.startChannelThread(message);
    const thread = await this.createThread(channelThread);
    await this.addMessageToThread(thread, message);
    const run = await this.runThread(thread);

    try {
      await this.waitForRunResponse(thread, run, channelThread);
    } catch (error) {
      this.logger.error(`Thread run failed. Status: ${error}`);
      return;
    }

    const reply = await this.getBotReply(thread);
    await channelThread.send(reply);
  }

  private async continueConversation(message: Message) {
    const thread = await this.getThread(message.channel.id);
    if (!thread) {
      this.logger.warn(
        'No openAI thread for this discord thread. Ignoring.',
      );
      return;
    }

    if (thread.assistantId !== this.assistantId) {
      return;
    }

    this.logger.info(
      `(${message.author.displayName}) ${message.content.substring(
        0,
        50,
      )}...`,
    );

    this.logger.debug('Responding to thread...');
    await this.addMessageToThread(thread, message);
    const run = await this.runThread(thread);

    try {
      await this.waitForRunResponse(thread, run, message.channel);
    } catch (error) {
      this.logger.error(`Thread run failed. Status: ${error}`);
      return;
    }

    const reply = await this.getBotReply(thread);
    await message.reply(reply);
  }

  isForMe(message: Message) {
    const mentionedBots = message.mentions.users.filter(
      (user) => user.bot,
    );

    if (mentionedBots.size === 0 || mentionedBots.size > 1) {
      // The mentioned bot should only be me!
      return false;
    }

    if (mentionedBots.first().id !== this.client.user.id) {
      // This is not me!
      return false;
    }

    return true;
  }

  async startChannelThread(message: Message) {
    const title = generateTitle(message.content);

    return message.startThread({
      name: title,
      autoArchiveDuration: AUTO_THREAD_ARCHIVE_IN_MINUTES,
    });
  }

  async getThread(discordThreadId: string) {
    const threadResult = await this.databases.listDocuments<Thread>(
      DATABASE,
      DatabaseCollection.Threads,
      [Query.equal('discordThreadId', discordThreadId)],
    );

    return threadResult.documents[0];
  }

  async createThread(channel: TextBasedChannel) {
    const openAIThread = await this.openAI.beta.threads.create();

    return this.databases.createDocument<Thread>(
      DATABASE,
      DatabaseCollection.Threads,
      ID.unique(),
      {
        discordThreadId: channel.id,
        openAIThreadId: openAIThread.id,
        assistantId: this.assistantId,
      } as Thread,
    );
  }

  async addMessageToThread(thread: Thread, message: Message) {
    return this.openAI.beta.threads.messages.create(
      thread.openAIThreadId,
      { role: 'user', content: message.content },
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
    channel: TextBasedChannel,
  ) {
    return new Promise((resolve, reject) => {
      (async () => {
        channel.sendTyping();

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
          channel.sendTyping();
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
    return this.client.destroy();
  }
}

export default Sidekick;
