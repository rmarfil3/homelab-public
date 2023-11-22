import EventEmitter from 'node:events';

import { createLogger, generateTitle } from '@homelab/utils';
import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
} from 'discord.js';
import { Logger } from 'winston';

import { AUTO_THREAD_ARCHIVE_IN_MINUTES } from '../constants';
import { PlatformEvent } from '../enums';
import { PlatformSidekickInterface } from '../interfaces';
import { Platform } from '../schemas';
import { UserMessage } from '../types';

class DiscordPlatformSidekick
  extends EventEmitter
  implements PlatformSidekickInterface
{
  public readonly platform = Platform.DISCORD;

  private readonly name: string;
  private readonly assistantId: string;
  private readonly discordBotToken: string;
  private client: Client;
  private logger: Logger;

  constructor(
    name: string,
    assistantId: string,
    discordBotToken: string,
  ) {
    super();
    this.name = name;
    this.assistantId = assistantId;
    this.discordBotToken = discordBotToken;
    this.logger = createLogger(`${this.name} via ${this.platform}`);

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  async start() {
    await this.client.login(this.discordBotToken);

    this.client.on(Events.ClientReady, () => {
      this.emit(PlatformEvent.READY);
    });

    this.client.on(
      Events.MessageCreate,
      this.onMessageCreate.bind(this),
    );
  }

  async onMessageCreate(message: Message) {
    if (message.author.bot || message.system) {
      return;
    }

    let platformThreadId = message.channel.id;

    if (!message.channel.isThread()) {
      if (!this.isForMe(message)) {
        return;
      }

      this.logger.info('Starting new thread for this message...');

      const channelThread = await this.startChannelThread(message);
      platformThreadId = channelThread.id;
    } else {
      const threadStarterMessage =
        await message.channel.fetchStarterMessage();
      if (!this.isForMe(threadStarterMessage)) {
        // Existing thread but not for me. Ignoring...
        return;
      }
    }

    this.logger.info(
      `(${message.author.displayName}) ${message.content.substring(
        0,
        100,
      )}...`,
    );

    this.logger.info('Responding to thread...');

    const userMessage: UserMessage<Message> = {
      platformThreadId,
      assistantId: this.assistantId,
      content: message.content,
      originalPlatformMessage: message,
      user: {
        displayName: message.author.displayName,
        id: message.author.id,
        username: message.author.username,
      },
    };

    this.emit(PlatformEvent.MESSAGE, userMessage);
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

  async sendTyping(userMessage: UserMessage<Message>) {
    if (userMessage.originalPlatformMessage.thread) {
      userMessage.originalPlatformMessage.thread.sendTyping();
      return;
    }

    userMessage.originalPlatformMessage.channel.sendTyping();
  }

  async reply(userMessage: UserMessage<Message>, reply: string) {
    if (userMessage.originalPlatformMessage.thread) {
      await userMessage.originalPlatformMessage.thread.send(reply);
      return;
    }

    await userMessage.originalPlatformMessage.reply(reply);
  }

  async shutdown() {
    return this.client.destroy();
  }
}

export default DiscordPlatformSidekick;
