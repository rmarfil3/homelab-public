import process from 'process';

import { logger } from '@homelab/utils';
import { HttpStatusCode } from 'axios';
import {
  AppwriteException,
  Client,
  Databases,
  Health,
  ID,
  Query,
} from 'node-appwrite';

class AppwriteSingleton {
  private static instance: Client;
  private static database: string;
  private static collectionSystemConfig: string;

  public static async init(
    database: string,
    collectionSystemConfig: string,
  ) {
    this.database = database;
    this.collectionSystemConfig = collectionSystemConfig;

    logger.info(
      `Creating Appwrite instance: ${process.env.APPWRITE_ENDPOINT}...`,
    );

    AppwriteSingleton.instance = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT)
      .setKey(process.env.APPWRITE_API_KEY);

    await this.waitForDatabase();

    const databases = new Databases(AppwriteSingleton.instance);

    try {
      await databases.get(this.database);
    } catch (e) {
      if (!(e instanceof AppwriteException)) {
        throw e;
      }

      if (e.code !== HttpStatusCode.NotFound) {
        throw e;
      }

      logger.info(`Creating database...`);
      await databases.create(this.database, this.database);
    }

    try {
      await databases.getCollection(
        this.database,
        this.collectionSystemConfig,
      );
    } catch (e) {
      if (!(e instanceof AppwriteException)) {
        throw e;
      }

      if (e.code !== HttpStatusCode.NotFound) {
        throw e;
      }

      logger.info(`Creating system config collection...`);
      await databases.createCollection(
        this.database,
        this.collectionSystemConfig,
        'System Configuration',
      );

      await databases.createStringAttribute(
        this.database,
        this.collectionSystemConfig,
        'config_name',
        100,
        true,
      );

      await databases.createStringAttribute(
        this.database,
        this.collectionSystemConfig,
        'config_value',
        1000,
        true,
      );
    }
  }

  private static async waitForDatabase() {
    const health = new Health(AppwriteSingleton.instance);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await health.getDB();
        break;
      } catch (e) {
        if (!(e instanceof AppwriteException)) {
          throw e;
        }
      }
    }
  }

  static getInstance() {
    if (!AppwriteSingleton.instance) {
      logger.error('Please run AppwriteSingleton.init() first.');
    }

    return AppwriteSingleton.instance;
  }

  private static async findConfig<
    SystemConfigCollectionKey extends string,
  >(key: SystemConfigCollectionKey) {
    const databases = new Databases(AppwriteSingleton.instance);

    const result = await databases.listDocuments(
      this.database,
      this.collectionSystemConfig,
      [Query.equal('config_name', key)],
    );

    if (!result.documents.length) {
      return null;
    }

    return result.documents[0];
  }

  static async getConfig<SystemConfigCollectionKey extends string>(
    key: SystemConfigCollectionKey,
  ) {
    const document = await AppwriteSingleton.findConfig(key);
    return document?.['config_value'];
  }

  static async setConfig<SystemConfigCollectionKey extends string>(
    key: SystemConfigCollectionKey,
    value: string,
  ) {
    const databases = new Databases(AppwriteSingleton.instance);

    const document = await AppwriteSingleton.findConfig(key);

    const data = {
      config_name: key,
      config_value: value,
    };

    if (document) {
      await databases.updateDocument(
        this.database,
        this.collectionSystemConfig,
        document.$id,
        data,
      );
    } else {
      await databases.createDocument(
        this.database,
        this.collectionSystemConfig,
        ID.unique(),
        data,
      );
    }
  }

  constructor() {
    throw new Error('Use AppwriteSingleton.init() instead');
  }
}

export { AppwriteSingleton };
