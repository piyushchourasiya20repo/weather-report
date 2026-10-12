import { NestFactory } from '@nestjs/core';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import {
  AppDataSource,
  closeRedisClient,
  initializeRedisClient,
} from './config';
import { bootstrapLogger } from './config/logger';
import { env } from './config/env';
import { APP_CONSTANTS } from './constants';

export async function bootstrap() {
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      bootstrapLogger.info('Database connection established');
    }

    await AppDataSource.runMigrations();
    await AppDataSource.destroy();
    bootstrapLogger.info('Database migrations completed');

    try {
      await initializeRedisClient();
      bootstrapLogger.info('Redis connection established');
    } catch (error) {
      bootstrapLogger.warn(
        { err: error },
        'Redis is unavailable; continuing without Redis features',
      );
    }

    app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(PinoNestLogger));
    app.enableShutdownHooks();
    const port = Number(env.PORT ?? APP_CONSTANTS.DEFAULT_PORT);
    await app.listen(port);
    app.get(PinoNestLogger).log(`Weather Report API listening on port ${port}`);
  } catch (error) {
    bootstrapLogger.fatal({ err: error }, 'Application startup failed');
    await app?.close().catch((closeError: unknown) => {
      bootstrapLogger.error({ err: closeError }, 'Failed to close Nest application');
    });
    await closeRedisClient();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy().catch((closeError: unknown) => {
        bootstrapLogger.error({ err: closeError }, 'Failed to close migration database connection');
      });
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void bootstrap();
}
