import { AppwriteSingleton } from '@homelab/services';
import { createLogger } from '@homelab/utils';
import { Databases, ID, Query } from 'node-appwrite';
import { Logger } from 'winston';

import { DATABASE } from './constants';
import { PlatformEvent, SupervisorCommandCode } from './enums';
import { PlatformSupervisorInterface } from './interfaces';
import DiscordPlatformSidekick from './providers/DiscordPlatformSidekick';
import TelegramPlatformSidekick from './providers/TelegramPlatformSidekick';
import { Assistant, DatabaseCollection, Platform } from './schemas';
import Sidekick from './sidekick';
import { SupervisorCommand } from './types';

class Supervisor {
  private databases: Databases;
  private sidekicks: Sidekick[];
  private logger: Logger;
  private platform: PlatformSupervisorInterface;

  constructor(platform: PlatformSupervisorInterface) {
    this.platform = platform;
    this.databases = new Databases(AppwriteSingleton.getInstance());
    this.logger = createLogger(
      `Supervisor via ${this.platform.platform}`,
    );

    this.platform.on(PlatformEvent.READY, this.onReady.bind(this));
    this.platform.on(
      PlatformEvent.COMMAND,
      this.runCommand.bind(this),
    );
  }

  async start() {
    await this.platform.start();
    await this.initializeSidekicks();
  }

  onReady() {
    this.logger.info("It's supervising time.");
  }

  async initializeSidekicks() {
    const assistants = (
      await this.databases.listDocuments<Assistant>(
        DATABASE,
        DatabaseCollection.Assistants,
        [Query.equal('platform', this.platform.platform)],
      )
    ).documents;

    this.sidekicks = await Promise.all(
      assistants.map(async (assistant) => {
        const platform = new (this.getPlatformSidekickClass())(
          assistant.name,
          assistant.assistantId,
          assistant.discordToken, // TODO: Rename to platformToken
        );

        const sidekick = new Sidekick(
          assistant.name,
          assistant.assistantId,
          platform,
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

  getPlatformSidekickClass() {
    if (this.platform.platform === Platform.DISCORD) {
      return DiscordPlatformSidekick;
    } else if (this.platform.platform === Platform.TELEGRAM) {
      return TelegramPlatformSidekick;
    }
  }

  async runCommand(command: SupervisorCommand) {
    switch (command.commandCode) {
      case SupervisorCommandCode.RESTART:
        await this.refreshSidekicks();
        await this.platform.reply(
          command,
          'Sidekicks have been refreshed.',
        );
        break;

      case SupervisorCommandCode.ADD_SIDEKICK:
        await this.addSidekick(command);
        break;

      default:
        this.logger.error(
          `${command.commandCode} is not currently handled.`,
        );
    }
  }

  async refreshSidekicks() {
    this.logger.info('Restarting sidekicks...');

    await Promise.all(
      this.sidekicks.map((sidekick) => sidekick.logout()),
    );

    await this.initializeSidekicks();
  }

  async addSidekick(command: SupervisorCommand) {
    const assistant: Partial<Assistant> = {
      assistantId: command.data['assistant_id'],
      discordToken: command.data['discord_token'],
      name: command.data['name'],
      platform: this.platform.platform,
    };

    await this.databases.createDocument(
      DATABASE,
      DatabaseCollection.Assistants,
      ID.unique(),
      assistant,
    );

    await this.platform.reply(
      command,
      `Sidekick **${assistant.name}** added.`,
    );

    await this.refreshSidekicks();
  }
}

export default Supervisor;
