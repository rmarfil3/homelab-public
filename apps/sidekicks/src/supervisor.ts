import { AppwriteSingleton } from '@homelab/services';
import { createLogger } from '@homelab/utils';
import {
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  InteractionType,
  Message,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';
import { Databases, ID } from 'node-appwrite';
import { Logger } from 'winston';

import { DATABASE } from './constants';
import {
  SupervisorCommand,
  SystemConfigCollectionKey,
} from './enums';
import { Assistant, DatabaseCollection } from './schemas';
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
    this.client.on(Events.ClientReady, this.onReady.bind(this));
    this.client.on(
      Events.MessageCreate,
      this.onMessageCreate.bind(this),
    );
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

    await this.initializeSidekicks();
  }

  async registerSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName(SupervisorCommand.RELOAD_COMMANDS)
        .setDescription('Reload slash commands (for dev)'),
      new SlashCommandBuilder()
        .setName(SupervisorCommand.RESTART)
        .setDescription(
          'Restarts the sidekicks by fetching list again from the database.',
        ),
      new SlashCommandBuilder()
        .setName(SupervisorCommand.ADD_SIDEKICK)
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
        if (command.name === SupervisorCommand.RELOAD_COMMANDS) {
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

  onReady() {
    this.logger.info("It's supervising time.");
  }

  async initializeSidekicks() {
    const assistants = (
      await this.databases.listDocuments<Assistant>(
        DATABASE,
        DatabaseCollection.Assistants,
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

    // Nothing for now
  }

  async onInteractionCreate(interaction: Interaction) {
    if (!interaction.isCommand()) {
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      await this.runCommand(
        interaction as ChatInputCommandInteraction,
      );
    }
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

  async runCommand(interaction: ChatInputCommandInteraction) {
    switch (interaction.commandName) {
      case SupervisorCommand.RELOAD_COMMANDS:
        await this.registerSlashCommands();
        await interaction.reply('Slash commands reloaded.');
        break;

      case SupervisorCommand.RESTART:
        await this.refreshSidekicks();
        await interaction.reply('Sidekicks have been refreshed.');
        break;

      case SupervisorCommand.ADD_SIDEKICK:
        await this.addSidekick(interaction);
        break;

      default:
        this.logger.error(
          `${interaction.commandName} is not currently handled.`,
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

  async addSidekick(interaction: ChatInputCommandInteraction) {
    const assistant: Partial<Assistant> = {
      name: interaction.options.getString('name'),
      assistantId: interaction.options.getString('assistant_id'),
      discordToken: interaction.options.getString('discord_token'),
    };

    await this.databases.createDocument(
      DATABASE,
      DatabaseCollection.Assistants,
      ID.unique(),
      assistant,
    );

    await interaction.reply(`Sidekick **${assistant.name}** added.`);

    await this.refreshSidekicks();
  }
}

export default Supervisor;
