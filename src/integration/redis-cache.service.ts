import { getRedisClient } from '../config';
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
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return null;
      }
      const value = await redisClient.get(key);
      if (value) {
        this.logger.debug({ key }, 'Redis cache hit');
        return JSON.parse(value) as T;
      }
      this.logger.debug({ key }, 'Redis cache miss');
      return null;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis cache read failed');
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = CACHE_CONSTANTS.DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      this.logger.debug({ key, ttl }, 'Redis cache entry set');
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis cache write failed');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      await redisClient.del(key);
      this.logger.debug({ key }, 'Redis cache entry deleted');
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis cache delete failed');
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      if (keys.length > 0) {
        await redisClient.del(keys);
        this.logger.debug({ keyCount: keys.length }, 'Redis cache entries deleted');
      }
    } catch (error) {
      this.logger.warn({ err: error, keyCount: keys.length }, 'Redis cache delete failed');
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return;
      }
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        this.logger.debug({ pattern, keyCount: keys.length }, 'Redis cache entries deleted');
      }
    } catch (error) {
      this.logger.warn({ err: error, pattern }, 'Redis cache delete failed');
    }
  }

  async incrementKey(key: string): Promise<number> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        this.logger.warn('Redis client is unavailable');
        return 0;
      }

      const count = await redisClient.incr(key);

      // Start the six-hour expiry when the counter is first created.
      if (count === 1) {
        await redisClient.expire(key, CACHE_CONSTANTS.COUNTER_TTL_SECONDS);
      }

      return count;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis counter increment failed');
      return 0;
    }
  }
}
