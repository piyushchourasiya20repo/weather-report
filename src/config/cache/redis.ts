import { createClient, type RedisClientType } from 'redis';
import { redisConfig } from './redis.config';
import { bootstrapLogger } from '../logger';
import { APP_CONSTANTS, REDIS_DEFAULTS } from '../../constants';

export const REDIS_KEY_PREFIX = `${APP_CONSTANTS.NAME}:`;

export function withRedisPrefix(key: string): string {
  return `${REDIS_KEY_PREFIX}${key}`;
}

let redisClient: RedisClientType | null = null;
let isConnecting = false;
const logger = bootstrapLogger.child({ component: 'redis' });

/** Connect to Redis and verify the connection before sharing the client. */
export async function initializeRedisClient(): Promise<void> {
  if (redisClient) {
    logger.debug('Redis client is already initialized');
    return;
  }

  if (isConnecting) {
    logger.debug('Redis connection is already in progress');
    return;
  }

  isConnecting = true;
  let client: RedisClientType | undefined;

  try {
    const redisHost = redisConfig.host;

    logger.info({ host: redisHost, port: redisConfig.port }, 'Connecting to Redis');

    client = createClient({
      socket: {
        host: redisHost,
        port: redisConfig.port,
        reconnectStrategy: (retries: number) => {
          if (retries > REDIS_DEFAULTS.MAX_RETRIES) {
            logger.error('Maximum Redis reconnection attempts reached');
            return new Error('Max reconnection attempts');
          }
          return Math.min(
            retries * REDIS_DEFAULTS.RETRY_DELAY_MS,
            REDIS_DEFAULTS.MAX_RETRY_DELAY_MS,
          );
        },
        connectTimeout: REDIS_DEFAULTS.CONNECT_TIMEOUT_MS,
        keepAlive: REDIS_DEFAULTS.KEEP_ALIVE_MS,
      },
      password: redisConfig.password || undefined,
      ...(redisConfig.db && { database: redisConfig.db }),
      ...(redisConfig.tls && { tls: redisConfig.tls }),
    }) as RedisClientType;

    client.on('error', (error: Error) => {
      logger.error({ err: error }, 'Redis client error');
    });

    client.on('connect', () => {
      logger.info({ host: redisHost, port: redisConfig.port }, 'Redis connected');
    });

    client.on('reconnecting', () => {
      logger.warn('Redis reconnecting');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    await client.connect();

    const pongResponse = await client.ping();
    if (pongResponse === 'PONG') {
      redisClient = client;
      isConnecting = false;
      logger.info('Redis connection verified');
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error) {
    isConnecting = false;
    logger.error(
      { err: error, host: redisConfig.host, port: redisConfig.port },
      'Failed to initialize Redis client',
    );
    if (client?.isOpen) {
      await client.quit().catch((closeError: unknown) => {
        logger.warn({ err: closeError }, 'Failed to close Redis client after connection error');
      });
    }
    throw error;
  }
}

/** Returns null when Redis is unavailable so callers can fall back. */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export function isRedisConnected(): boolean {
  return redisClient !== null && redisClient.isOpen;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
      redisClient = null;
    } catch (error) {
      logger.error({ err: error }, 'Failed to close Redis connection');
      redisClient = null;
    }
  }
}

export async function getRedisInfo(): Promise<Record<string, unknown> | null> {
  if (!redisClient) {
    return null;
  }

  try {
    const info = await redisClient.info();
    return { info };
  } catch (error) {
    logger.warn({ err: error }, 'Failed to read Redis server info');
    return null;
  }
}

