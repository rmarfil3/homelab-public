import EventEmitter from 'node:events';

import { AppwriteSingleton } from '@homelab/services';
import { createLogger } from '@homelab/utils';
import {
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  InteractionType,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';
import { reduce } from 'lodash';
import { Logger } from 'winston';

import {
  PlatformEvent,
  SupervisorCommandCode,
  SystemConfigCollectionKey,
} from '../enums';
import { PlatformSupervisorInterface } from '../interfaces';
import { Platform } from '../schemas';
import { SupervisorCommand } from '../types';

class DiscordPlatformSupervisor
  extends EventEmitter
  implements PlatformSupervisorInterface
{
  public readonly platform = Platform.DISCORD;

  private readonly discordBotToken: string;
  private client: Client;
  private logger: Logger;

  constructor(discordBotToken: string) {
    super();
    this.discordBotToken = discordBotToken;
    this.logger = createLogger(`Supervisor via ${this.platform}`);

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
      Events.InteractionCreate,
      this.onInteractionCreate.bind(this),
    );

    const isSlashCommandsLoaded = await AppwriteSingleton.getConfig(
      SystemConfigCollectionKey.DISCORD_SLASH_COMMANDS_LOADED,
    );

    if (!isSlashCommandsLoaded) {
      await this.registerSlashCommands();
      await AppwriteSingleton.setConfig(
        SystemConfigCollectionKey.DISCORD_SLASH_COMMANDS_LOADED,
        'true',
      );
    }
  }

  async registerSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName(SupervisorCommandCode.RELOAD_COMMANDS)
        .setDescription('Reload slash commands (for dev)'),
      new SlashCommandBuilder()
        .setName(SupervisorCommandCode.RESTART)
        .setDescription(
          'Restarts the sidekicks by fetching list again from the database.',
        ),
      new SlashCommandBuilder()
        .setName(SupervisorCommandCode.ADD_SIDEKICK)
        .setDescription('Adds a new sidekick to the database.')
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName('name')
            .setDescription('Name of the new sidekick')
            .setRequired(true)
            .setMaxLength(200),
        )
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName('assistant_id')
            .setDescription(
              'The OpenAI Assistant ID, taken from OpenAI platform',
            )
            .setRequired(true)
            .setMaxLength(1000),
        )
        .addStringOption((option: SlashCommandStringOption) =>
          option
            .setName('discord_token')
            .setDescription(
              'The Discord Bot Token, taken from Discord Developer Portal',
            )
            .setRequired(true)
            .setMaxLength(1000),
        ),
    ];

    const registeredCommands =
      await this.client.application.commands.fetch();

    await Promise.all(
      commands.map((command) => {
        if (command.name === SupervisorCommandCode.RELOAD_COMMANDS) {
          return;
        }

        const registeredCommand = registeredCommands.find(
          (thisRegisteredCommand) =>
            thisRegisteredCommand.name === command.name,
        );

        if (registeredCommand) {
          this.logger.info(`Reloading ${command.name} command...`);
          registeredCommand.edit(command);
          return;
        }

        this.logger.info(`Adding ${command.name} command...`);
        this.client.application.commands.create(command);
      }),
    );
  }

  async onInteractionCreate(interaction: Interaction) {
    if (!interaction.isCommand()) {
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      if (
        interaction.commandName ===
        SupervisorCommandCode.RELOAD_COMMANDS
      ) {
        await this.registerSlashCommands();
        await interaction.reply('Slash commands reloaded.');
        return;
      }

      const command: SupervisorCommand<Interaction> = {
        commandCode: interaction.commandName as SupervisorCommandCode,
        data: reduce(
          interaction.options.data,
          (obj, item) => {
            obj[item.name] = item.value;
            return obj;
          },
          {},
        ) as unknown as Record<string, string>,
        originalPlatformCommand: interaction,
        user: {
          displayName: interaction.user.displayName,
          id: interaction.user.id,
          username: interaction.user.username,
        },
      };

      this.emit(PlatformEvent.COMMAND, command);
    }
  }

  async reply(
    command: SupervisorCommand<ChatInputCommandInteraction>,
    reply: string,
  ) {
    await command.originalPlatformCommand.reply(reply);
  }

  async shutdown() {
    return this.client.destroy();
  }
}

export default DiscordPlatformSupervisor;
