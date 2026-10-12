import { REDIS_DEFAULTS } from '../../constants';
import { env } from '../env';

export const redisConfig = {
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT, 10),
  password: env.REDIS_PASSWORD,
  db: parseInt(env.REDIS_DB, 10),

  ...(env.REDIS_TLS === 'true' && {
    tls: {},
  }),

  retryStrategy: (times: number) =>
    Math.min(
      times * REDIS_DEFAULTS.RETRY_DELAY_MS,
      REDIS_DEFAULTS.MAX_RETRY_DELAY_MS,
    ),
};
