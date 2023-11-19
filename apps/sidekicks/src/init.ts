import { AppwriteSingleton, OpenAIService } from '@homelab/services';

import { COLLECTION_SYSTEM_CONFIG, DATABASE } from './constants';

const init = async () => {
  await AppwriteSingleton.init(DATABASE, COLLECTION_SYSTEM_CONFIG);
  OpenAIService.init();
};

export default init;
