import EventEmitter from 'node:events';

import { AppwriteSingleton } from '@homelab/services';
import { createLogger, sanitizeMarkdown } from '@homelab/utils';
import { Databases, Query } from 'node-appwrite';
import { Context, Telegraf, session } from 'telegraf';
import { message as messageFilter } from 'telegraf/filters';
import { Message } from 'typegram';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';

import { DATABASE } from '../constants';
import { PlatformEvent } from '../enums';
import { PlatformSidekickInterface } from '../interfaces';
import {
  AllowedUser,
  DatabaseCollection,
  Platform,
} from '../schemas';
import { UserMessage } from '../types';

interface SessionData {
  sessionId: string;
}

interface SidekickContext extends Context {
  session?: SessionData;
}

class TelegramPlatformSidekick
  extends EventEmitter
  implements PlatformSidekickInterface
{
  public readonly platform = Platform.TELEGRAM;

  private readonly name: string;
  private readonly assistantId: string;
  private readonly telegramBotToken: string;
  private databases: Databases;
  private client: Telegraf<SidekickContext>;
  private logger: Logger;

  constructor(
    name: string,
    assistantId: string,
    telegramBotToken: string,
  ) {
    super();
    this.name = name;
    this.assistantId = assistantId;
    this.telegramBotToken = telegramBotToken;
    this.logger = createLogger(`${this.name} via ${this.platform}`);
    this.databases = new Databases(AppwriteSingleton.getInstance());
    this.client = new Telegraf<SidekickContext>(
      this.telegramBotToken,
    );
  }

  async start() {
    this.client.use(session());

    await this.client.telegram.setMyCommands([
      {
        command: 'reset',
        description:
          'Starts a new conversation, excluding previous messages from context',
      },
    ]);

    this.client.command('reset', this.reset.bind(this));

    this.client.on(
      messageFilter('text'),
      this.onMessageCreate.bind(this),
    );

    this.client.launch({
      dropPendingUpdates: true,
    });

    this.emit(PlatformEvent.READY);
  }

  async onMessageCreate(context: SidekickContext) {
    const message = context.message as Message.TextMessage;

    if (message.from.is_bot) {
      return;
    }

    const isUserAllowed = await this.isUserAllowed(
      message.from.id.toString(),
    );

    if (!isUserAllowed) {
      this.logger.info(`User ID ${message.from.id} is not allowed`);
      return;
    }

    const platformThreadId = await this.getPlatformThreadId(context);

    this.logger.info(
      `(${message.from.first_name}) ${message.text.substring(
        0,
        100,
      )}...`,
    );

    this.logger.info('Responding to thread...');

    const userMessage: UserMessage<SidekickContext> = {
      platformThreadId,
      assistantId: this.assistantId,
      content: message.text,
      originalPlatformMessage: context,
      user: {
        displayName: message.from.first_name,
        id: message.from.id.toString(),
        username: message.from.username,
      },
    };

    this.emit(PlatformEvent.MESSAGE, userMessage);
  }

  async isUserAllowed(userId: string) {
    const userResult =
      await this.databases.listDocuments<AllowedUser>(
        DATABASE,
        DatabaseCollection.AllowedUsers,
        [
          Query.equal('userId', userId),
          Query.equal('platform', this.platform),
        ],
      );
    return Boolean(userResult.documents[0]);
  }

  async getPlatformThreadId(context: SidekickContext) {
    if ((context.message.chat as any).is_forum) {
      return context.message.chat.id.toString();
    }

    context.session ??= { sessionId: uuidv4() };
    return context.session.sessionId;
  }

  async sendTyping(userMessage: UserMessage<SidekickContext>) {
    await userMessage.originalPlatformMessage.sendChatAction(
      'typing',
    );
  }

  async reply(
    userMessage: UserMessage<SidekickContext>,
    reply: string,
  ) {
    const sanitizedReply = sanitizeMarkdown(reply);

    try {
      await userMessage.originalPlatformMessage.reply(
        sanitizedReply,
        {
          parse_mode: 'MarkdownV2',
        },
      );
    } catch (error) {
      await userMessage.originalPlatformMessage.reply(
        sanitizedReply,
        {
          parse_mode: 'HTML',
        },
      );
    }
  }

  async reset(context: SidekickContext) {
    if (context.session) {
      context.session.sessionId = uuidv4();
    }

    this.logger.info('Session ID has been reset.');
    await context.reply('Session has been reset.');
    return;
  }

  async shutdown() {
    // intentionally blank
  }
}

export default TelegramPlatformSidekick;
