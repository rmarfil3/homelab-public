import EventEmitter from 'node:events';

import { createLogger } from '@homelab/utils';
import { ChatInputCommandInteraction, Client } from 'discord.js';
import { Logger } from 'winston';

import { PlatformSupervisorInterface } from '../interfaces';
import { Platform } from '../schemas';
import { SupervisorCommand } from '../types';

class TelegramPlatformSupervisor
  extends EventEmitter
  implements PlatformSupervisorInterface
{
  public readonly platform = Platform.TELEGRAM;

  private readonly telegramBotToken: string;
  private client: Client;
  private logger: Logger;

  constructor(telegramBotToken: string) {
    super();
    this.telegramBotToken = telegramBotToken;
    this.logger = createLogger(`Supervisor via ${this.platform}`);
  }

  async start() {
    // await this.client.login(this.telegramBotToken);
    //
    // this.client.on(Events.ClientReady, () => {
    //   this.emit(PlatformEvent.READY);
    // });
    //
    // this.client.on(
    //   Events.InteractionCreate,
    //   this.onInteractionCreate.bind(this),
    // );
    //
    // const isSlashCommandsLoaded = await AppwriteSingleton.getConfig(
    //   SystemConfigCollectionKey.DISCORD_SLASH_COMMANDS_LOADED,
    // );
    //
    // if (!isSlashCommandsLoaded) {
    //   await this.registerSlashCommands();
    //   await AppwriteSingleton.setConfig(
    //     SystemConfigCollectionKey.DISCORD_SLASH_COMMANDS_LOADED,
    //     'true',
    //   );
    // }
  }

  async reply(
    _command: SupervisorCommand<ChatInputCommandInteraction>,
    _reply: string,
  ) {
    // await command.originalPlatformCommand.reply(reply);
  }

  async shutdown() {
    // return this.client.destroy();
  }
}

export default TelegramPlatformSupervisor;
