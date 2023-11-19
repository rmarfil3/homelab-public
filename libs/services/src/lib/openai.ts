import { logger } from '@homelab/utils';
import OpenAI from 'openai';

class OpenAIService {
  private static instance: OpenAI;

  static init() {
    logger.info('Initializing OpenAI instance...');

    OpenAIService.instance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  static getInstance() {
    if (!OpenAIService.instance) {
      logger.error('Please run OpenAIService.init() first.');
    }

    return OpenAIService.instance;
  }

  constructor() {
    throw new Error('Use OpenAIService.init() instead');
  }
}

export { OpenAIService };
