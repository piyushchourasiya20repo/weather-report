import { getRedisClient, withRedisPrefix } from '../config';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_CONSTANTS } from '../constants';

@Injectable()
export class RedisCacheService {
  constructor(
    @InjectPinoLogger(RedisCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const redisKey = withRedisPrefix(key);

    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return null;
      }
      const value = await redisClient.get(redisKey);
      if (value) {
        this.logger.debug({ key: redisKey }, 'Redis cache hit');
        return JSON.parse(value) as T;
      }
      this.logger.debug({ key: redisKey }, 'Redis cache miss');
      return null;
    } catch (error) {
      this.logger.warn({ err: error, key: redisKey }, 'Redis cache read failed');
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = CACHE_CONSTANTS.DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const redisKey = withRedisPrefix(key);

    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      await redisClient.setEx(redisKey, ttl, JSON.stringify(value));
      this.logger.debug({ key: redisKey, ttl }, 'Redis cache entry set');
    } catch (error) {
      this.logger.warn({ err: error, key: redisKey }, 'Redis cache write failed');
    }
  }

  async delete(key: string): Promise<void> {
    const redisKey = withRedisPrefix(key);

    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      await redisClient.del(redisKey);
      this.logger.debug({ key: redisKey }, 'Redis cache entry deleted');
    } catch (error) {
      this.logger.warn({ err: error, key: redisKey }, 'Redis cache delete failed');
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    const redisKeys = keys.map(withRedisPrefix);

    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      if (redisKeys.length > 0) {
        await redisClient.del(redisKeys);
        this.logger.debug({ keyCount: redisKeys.length }, 'Redis cache entries deleted');
      }
    } catch (error) {
      this.logger.warn({ err: error, keyCount: redisKeys.length }, 'Redis cache delete failed');
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const redisPattern = withRedisPrefix(pattern);

    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      const keys = await redisClient.keys(redisPattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        this.logger.debug({ pattern: redisPattern, keyCount: keys.length }, 'Redis cache entries deleted');
      }
    } catch (error) {
      this.logger.warn({ err: error, pattern: redisPattern }, 'Redis cache delete failed');
    }
  }

  async incrementKey(key: string): Promise<number> {
    const redisKey = withRedisPrefix(key);

    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return 0;
      }

      const count = await redisClient.incr(redisKey);

      // Start the six-hour expiry when the counter is first created.
      if (count === 1) {
        await redisClient.expire(redisKey, CACHE_CONSTANTS.COUNTER_TTL_SECONDS);
      }

      return count;
    } catch (error) {
      this.logger.warn({ err: error, key: redisKey }, 'Redis counter increment failed');
      return 0;
    }
  }
}
