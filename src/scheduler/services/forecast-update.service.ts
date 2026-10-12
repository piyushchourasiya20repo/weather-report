import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OpenMeteoService } from '../../integration/open-meteo.service';
import { CityRepository } from '../../module/weather/repositories/city.repository';
import { WeatherService } from '../../module/weather/weather.service';
import { getRedisClient } from '@/config/cache/redis';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import {
  SchedulerRun,
  SchedulerRunStatus,
} from '../entities/scheduler-run.entity';
import { SCHEDULER_CONSTANTS } from '../../constants';

@Injectable()
export class ForecastUpdateService {
  constructor(
    @InjectPinoLogger(ForecastUpdateService.name)
    private readonly logger: PinoLogger,
    private readonly weatherService: WeatherService,
    private readonly openMeteoService: OpenMeteoService,
    private readonly cityRepository: CityRepository,
    @InjectRepository(SchedulerRun)
    private readonly runRepository: Repository<SchedulerRun>,
    private readonly dataSource: DataSource,
  ) {}

  // Also used by POST /test/update-forecasts.
  async triggerManualUpdate(): Promise<{
    success: boolean;
    message: string;
    citiesUpdated: number;
    timestamp: string;
  }> {
    this.logger.info('Starting manual forecast update');
    const result = await this.updateForecastsForHighFrequentCities();
    return {
      success: true,
      message: 'Forecast update completed successfully',
      citiesUpdated: result.citiesUpdated,
      timestamp: new Date().toISOString(),
    };
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async updateForecastsForHighFrequentCities(): Promise<{
    citiesUpdated: number;
  }> {
    const lockConnection = this.dataSource.createQueryRunner();
    await lockConnection.connect();
    let lockAcquired = false;

    try {
      const [lockResult] = await lockConnection.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        [SCHEDULER_CONSTANTS.JOB_NAME],
      );
      lockAcquired = lockResult?.locked === true;

      if (!lockAcquired) {
        this.logger.info('A forecast update is already running; skipping');
        return { citiesUpdated: 0 };
      }

      return await this.runForecastUpdate();
    } finally {
      try {
        if (lockAcquired) {
          await lockConnection.query(
            'SELECT pg_advisory_unlock(hashtext($1))',
            [SCHEDULER_CONSTANTS.JOB_NAME],
          );
        }
      } finally {
        await lockConnection.release();
      }
    }
  }

  private async runForecastUpdate(): Promise<{ citiesUpdated: number }> {
    this.logger.info('Starting forecast update for frequently searched cities');

    let citiesUpdated = 0;
    let lastError: string | null = null;

    const recentRun = await this.runRepository.findOne({
      where: {
        jobName: SCHEDULER_CONSTANTS.JOB_NAME,
        status: In([
          SchedulerRunStatus.PROCESSING,
          SchedulerRunStatus.COMPLETED,
        ]),
        startedAt: MoreThan(
          new Date(Date.now() - SCHEDULER_CONSTANTS.MIN_INTERVAL_MS),
        ),
      },
    });
    if (recentRun) {
      this.logger.info(
        { startedAt: recentRun.startedAt, status: recentRun.status },
        'A recent forecast update already ran; skipping',
      );
      return { citiesUpdated: 0 };
    }

    const run = await this.runRepository.save(
      this.runRepository.create({
        jobName: SCHEDULER_CONSTANTS.JOB_NAME,
        status: SchedulerRunStatus.PROCESSING,
        startedAt: new Date(),
        finishedAt: null,
        recordsProcessed: 0,
        lastError: null,
      }),
    );

    try {
      const citiesWithHighSearchCount =
        await this.getCitiesWithSearchCountAboveThreshold();

      if (citiesWithHighSearchCount.length === 0) {
        this.logger.info(
          { threshold: SCHEDULER_CONSTANTS.SEARCH_COUNT_THRESHOLD },
          'No cities met the search threshold',
        );
        await this.finishRun(run, SchedulerRunStatus.COMPLETED, 0, null);
        return { citiesUpdated: 0 };
      }

      this.logger.info(
        {
          cityCount: citiesWithHighSearchCount.length,
          threshold: SCHEDULER_CONSTANTS.SEARCH_COUNT_THRESHOLD,
        },
        'Found cities to refresh',
      );

      for (const cityName of citiesWithHighSearchCount) {
        try {
          await this.updateForecastForCity(cityName);
          citiesUpdated++;
        } catch (error) {
          lastError = `${cityName}: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(
            { err: error, cityName },
            'Failed to refresh city forecast; continuing with the next city',
          );
        }
      }

      if (lastError) {
        throw new Error(`One or more city forecasts failed: ${lastError}`);
      }

      this.logger.info({ citiesUpdated }, 'Forecast update completed');
      await this.finishRun(run, SchedulerRunStatus.COMPLETED, citiesUpdated, null);
      return { citiesUpdated };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ err: error, citiesUpdated }, 'Forecast update failed');
      try {
        await this.finishRun(run, SchedulerRunStatus.FAILED, citiesUpdated, message);
      } catch (finishError) {
        this.logger.error(
          { err: finishError, originalError: error },
          'Failed to record forecast update failure',
        );
      }
      throw error;
    }
  }

  private async finishRun(
    run: SchedulerRun,
    status: SchedulerRunStatus,
    recordsProcessed: number,
    lastError: string | null,
  ): Promise<void> {
    run.status = status;
    run.finishedAt = new Date();
    run.recordsProcessed = recordsProcessed;
    run.lastError = lastError;
    await this.runRepository.save(run);
  }

  // Search counts are stored under city:searches:<city name>.
  private async getCitiesWithSearchCountAboveThreshold(): Promise<string[]> {
    const redisClient = getRedisClient();

    if (!redisClient || !redisClient.isOpen) {
      throw new Error('Redis is required to find frequently searched cities');
    }

    try {
      const citiesData: string[] = [];
      const pattern = `${SCHEDULER_CONSTANTS.REDIS_SEARCH_KEY_PREFIX}*`;

      for await (const key of redisClient.scanIterator({
        MATCH: pattern,
        COUNT: SCHEDULER_CONSTANTS.REDIS_SCAN_COUNT,
      })) {
        const cityName = key.replace(SCHEDULER_CONSTANTS.REDIS_SEARCH_KEY_PREFIX, '');
        const searchCount = await redisClient.get(key);

        if (
          searchCount &&
          parseInt(searchCount, 10) > SCHEDULER_CONSTANTS.SEARCH_COUNT_THRESHOLD
        ) {
          citiesData.push(cityName);
        }
      }

      return citiesData;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to read city search counts from Redis');
      throw error;
    }
  }

  private async updateForecastForCity(cityName: string): Promise<void> {
    this.logger.info({ cityName }, 'Refreshing city forecast');
    await this.weatherService.weatherByCityHelper(cityName, 'SCHEDULER');
  }
}
