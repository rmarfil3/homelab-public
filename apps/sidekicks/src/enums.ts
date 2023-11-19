export enum RunStatus {
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export enum SystemConfigCollectionKey {
  SUPERVISOR_DISCORD_TOKEN = 'supervisor_discord_token',
}

export enum SupervisorCommand {
  RESTART = 'restart',
}
