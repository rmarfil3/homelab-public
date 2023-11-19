import { AppwriteSingleton } from '@homelab/services';
import { createLogger, removeMentions } from '@homelab/utils';
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { Databases } from 'node-appwrite';
import { Logger } from 'winston';

import { DATABASE } from './constants';
import { SupervisorCommand } from './enums';
import { Assistant, Collection } from './schemas';
import Sidekick from './sidekick';

class Supervisor {
  private discordToken: string;
  private client: Client;
  private databases: Databases;
  private sidekicks: Sidekick[];
  private logger: Logger;

  constructor(discordToken: string) {
    this.discordToken = discordToken;
    this.databases = new Databases(AppwriteSingleton.getInstance());
    this.logger = createLogger('Supervisor');

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
    this.client.on('ready', this.onReady.bind(this));
    this.client.on('messageCreate', this.onMessageCreate.bind(this));

    await this.initializeSidekicks();
  }

  onReady() {
    this.logger.info("It's supervising time.");
  }

  async initializeSidekicks() {
    const assistants = (
      await this.databases.listDocuments<Assistant>(
        DATABASE,
        Collection.Assistants,
      )
    ).documents;

    this.sidekicks = await Promise.all(
      assistants.map(async (assistant) => {
        const sidekick = new Sidekick(
          assistant.name,
          assistant.assistantId,
          assistant.discordToken,
        );

        try {
          await sidekick.start();
        } catch (err) {
          this.logger.error(
            `${assistant.name} unable to start. Skipping.`,
          );
        }

        return sidekick;
      }),
    );
  }

  async onMessageCreate(message: Message) {
    if (message.author.bot || message.system) {
      return;
    }

    if (!this.isForMe(message)) {
      return;
    }

    const command = removeMentions(message.content).trim();

    await this.runCommand(command, message);
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

  async runCommand(command: string, message: Message) {
    switch (command) {
      case SupervisorCommand.RESTART:
        await this.refreshSidekicks(message);
        break;

      default:
        this.logger.error(`${command} not recognized.`);
    }
  }

  async refreshSidekicks(message: Message) {
    this.logger.info('Restarting sidekicks...');

    await Promise.all(
      this.sidekicks.map((sidekick) => sidekick.logout()),
    );

    await this.initializeSidekicks();

    await message.reply('Sidekicks have been refreshed.');
  }
}

export default Supervisor;
