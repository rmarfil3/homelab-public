import { AppwriteSingleton } from '@homelab/services';

import { SystemConfigCollectionKey } from './enums';
import init from './init';
import DiscordPlatformSupervisor from './providers/DiscordPlatformSupervisor';
import Supervisor from './supervisor';

const startDiscordSupervisor = async () => {
  const supervisorDiscordToken = await AppwriteSingleton.getConfig(
    SystemConfigCollectionKey.SUPERVISOR_DISCORD_TOKEN,
  );

  const platform = new DiscordPlatformSupervisor(
    supervisorDiscordToken,
  );

  const supervisor = new Supervisor(platform);
  await supervisor.start();
};

const start = async () => {
  await init();
  await startDiscordSupervisor();
};

start();
