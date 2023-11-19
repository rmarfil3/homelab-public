import { AppwriteSingleton } from '@homelab/services';

import { SystemConfigCollectionKey } from './enums';
import init from './init';
import Supervisor from './supervisor';

const startSupervisor = async () => {
  const supervisorDiscordToken = await AppwriteSingleton.getConfig(
    SystemConfigCollectionKey.SUPERVISOR_DISCORD_TOKEN,
  );

  const supervisor = new Supervisor(supervisorDiscordToken);
  await supervisor.start();
};

const start = async () => {
  await init();
  await startSupervisor();
};

start();
