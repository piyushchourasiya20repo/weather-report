import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Forecast } from '../entities/forecast.entity';
import { RedisCacheService } from '../../../integration/redis-cache.service';
import { CACHE_KEYS } from '../../../constants';

@Injectable()
export class ForecastRepository extends Repository<Forecast> {
  constructor(
    private dataSource: DataSource,
    private readonly redisCacheService: RedisCacheService,
  ) {
    super(Forecast, dataSource.createEntityManager());
  }

  async invalidateCity(cityId: string): Promise<void> {
    await this.redisCacheService.deleteMany([
      CACHE_KEYS.forecastRecent(cityId),
      CACHE_KEYS.latestFetch(cityId),
    ]);
  }

  async upsertForecast(
    forecast: Partial<Forecast>,
    manager?: EntityManager,
  ): Promise<Forecast> {
    const repository = manager?.getRepository(Forecast) ?? this;
    const forecastToUpsert = { ...forecast, fetchedAt: new Date() };

    await repository.upsert(forecastToUpsert, ['cityId', 'forecastDate']);

    const savedForecast = await repository.findOne({
      where: {
        cityId: forecast.cityId,
        forecastDate: forecast.forecastDate,
      },
      relations: { activityScores: true },
    });

    if (!savedForecast) {
      throw new Error('Forecast upsert completed but the row could not be reloaded');
    }

    return savedForecast;
  }

  async upsertForecastIfNewer(
    forecast: Partial<Forecast>,
    fetchedAt: Date,
    manager?: EntityManager,
  ): Promise<{ forecast: Forecast; updated: boolean }> {
    const repository = manager?.getRepository(Forecast) ?? this;
    const forecastToUpsert = { ...forecast, fetchedAt };
    const result = await repository
      .createQueryBuilder()
      .insert()
      .into(Forecast)
      .values(forecastToUpsert)
      .onConflict(
        `("city_id", "forecast_date") DO UPDATE SET
          "fetched_at" = EXCLUDED."fetched_at",
          "temperature_2m_max" = EXCLUDED."temperature_2m_max",
          "temperature_2m_min" = EXCLUDED."temperature_2m_min",
          "temperature_2m_mean" = EXCLUDED."temperature_2m_mean",
          "precipitation_sum" = EXCLUDED."precipitation_sum",
          "precipitation_probability_max" = EXCLUDED."precipitation_probability_max",
          "snowfall_sum" = EXCLUDED."snowfall_sum",
          "rain_sum" = EXCLUDED."rain_sum",
          "wind_speed_10m_max" = EXCLUDED."wind_speed_10m_max",
          "wind_gusts_10m_max" = EXCLUDED."wind_gusts_10m_max",
          "uv_index_max" = EXCLUDED."uv_index_max",
          "sunshine_duration" = EXCLUDED."sunshine_duration",
          "condition" = EXCLUDED."condition",
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "forecast"."fetched_at" < EXCLUDED."fetched_at"`,
      )
      .returning('*')
      .execute();

    const savedForecast = await repository.findOne({
      where: {
        cityId: forecast.cityId,
        forecastDate: forecast.forecastDate,
      },
      relations: { activityScores: true },
    });

    if (!savedForecast) {
      throw new Error('Forecast upsert completed but the row could not be reloaded');
    }

    return { forecast: savedForecast, updated: result.raw.length > 0 };
  }

  async saveForecast(forecast: Partial<Forecast>): Promise<Forecast> {
    return this.upsertForecast(forecast);
  }

  async getRecentForecastByCity(
    cityId: string,
    limit: number = 7,
  ): Promise<Forecast[]> {
    const cacheKey = CACHE_KEYS.forecastRecent(cityId);
    const cached = await this.redisCacheService.get<Forecast[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const forecasts = await this.createQueryBuilder('forecast')
      .leftJoinAndSelect('forecast.activityScores', 'activityScores')
      .where('forecast.cityId = :cityId', { cityId })
      .orderBy('forecast.forecastDate', 'ASC')
      .take(limit)
      .getMany();

    if (forecasts.length > 0) {
      await this.redisCacheService.set(cacheKey, forecasts);
    }

    return forecasts;
  }

  async getForecastByDateAndCity(
    cityId: string,
    forecastDate: Date,
  ): Promise<Forecast | null> {
    const forecast = await this.createQueryBuilder('forecast')
      .leftJoinAndSelect('forecast.activityScores', 'activityScores')
      .where('forecast.cityId = :cityId', { cityId })
      .andWhere('forecast.forecastDate = :forecastDate', { forecastDate })
      .getOne();

    return forecast || null;
  }

  async getExpiredForecasts(beforeDate: Date): Promise<Forecast[]> {
    return this.createQueryBuilder('forecast')
      .where('forecast.forecastDate < :beforeDate', { beforeDate })
      .getMany();
  }

  async deleteExpiredForecasts(beforeDate: Date): Promise<number> {
    const result = await this.createQueryBuilder()
      .delete()
      .from(Forecast)
      .where('forecastDate < :beforeDate', { beforeDate })
      .setParameters({ beforeDate })
      .execute();
    return result.affected || 0;
  }

  async deleteAllByCityId(cityId: string): Promise<number> {
    const result = await this.delete({ cityId });
    if (result.affected) {
      await this.invalidateCity(cityId);
    }

    return result.affected || 0;
  }

  async getLatestFetchTimeForCity(cityId: string): Promise<Date | null> {
    const cacheKey = CACHE_KEYS.latestFetch(cityId);
    const cached = await this.redisCacheService.get<string>(cacheKey);
    if (cached) {
      return new Date(cached);
    }

    const result = await this.createQueryBuilder('forecast')
      .select('forecast.fetchedAt')
      .where('forecast.cityId = :cityId', { cityId })
      .orderBy('forecast.fetchedAt', 'DESC')
      .take(1)
      .getRawOne();

    const fetchTime = result?.forecast_fetched_at || null;
    if (fetchTime) {
      await this.redisCacheService.set(cacheKey, new Date(fetchTime).toISOString());
    }

    return fetchTime;
  }
}
