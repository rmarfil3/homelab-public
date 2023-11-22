export enum RunStatus {
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export enum SystemConfigCollectionKey {
  SUPERVISOR_DISCORD_TOKEN = 'supervisor_discord_token',
  DISCORD_SLASH_COMMANDS_LOADED = 'discord_slash_commands_loaded',
}

export enum SupervisorCommand {
  RELOAD_COMMANDS = 'reload-commands',
  RESTART = 'restart',
  ADD_SIDEKICK = 'add-sidekick',
}

export enum PlatformEvent {
  READY = 'ready',
  MESSAGE = 'message',
}
