import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Forecast } from '../entities/forecast.entity';
import { ActivityScore } from '../entities/activity-score.entity';
import { ForecastRepository } from '../repositories/forecast.repository';
import { ActivityScoreRepository } from '../repositories/activity-score.repository';

@Injectable()
export class ForecastPersistenceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly forecastRepository: ForecastRepository,
    private readonly activityScoreRepository: ActivityScoreRepository,
  ) {}

  async storeForecastData(
    cityId: string,
    forecastData: Array<{
      date: string;
      temperature_2m_max: number;
      temperature_2m_min: number;
      temperature_2m_mean: number;
      precipitation_sum: number;
      precipitation_probability_max: number;
      snowfall_sum: number;
      rain_sum: number;
      wind_speed_10m_max: number;
      wind_gusts_10m_max: number;
      uv_index_max: number;
      sunshine_duration: number;
      condition: string;
      activityRatings: Array<{
        activity: string;
        score: number;
        scoreText: string;
        reasoning: string[];
      }>;
    }>,
    fetchedAt: Date = new Date(),
  ): Promise<Forecast[]> {
    if (forecastData.length === 0) {
      return [];
    }

    let anyUpdated = false;

    const savedForecasts = await this.dataSource.transaction(async (manager) => {
      const savedForecasts: Forecast[] = [];

      for (const dailyData of forecastData) {
        const forecastDate = new Date(dailyData.date);

        const forecastEntity = this.forecastRepository.create({
          cityId,
          forecastDate,
          temperature2mMax: dailyData.temperature_2m_max,
          temperature2mMin: dailyData.temperature_2m_min,
          temperature2mMean: dailyData.temperature_2m_mean,
          precipitationSum: dailyData.precipitation_sum,
          precipitationProbabilityMax: dailyData.precipitation_probability_max,
          snowfallSum: dailyData.snowfall_sum,
          rainSum: dailyData.rain_sum,
          windSpeed10mMax: dailyData.wind_speed_10m_max,
          windGusts10mMax: dailyData.wind_gusts_10m_max,
          uvIndexMax: dailyData.uv_index_max,
          sunshineDuration: dailyData.sunshine_duration,
          condition: dailyData.condition,
        });

        const { forecast: upsertedForecast, updated } =
          await this.forecastRepository.upsertForecastIfNewer(
            forecastEntity,
            fetchedAt,
            manager,
          );

        if (updated) {
          anyUpdated = true;
          const activityScoreEntities = dailyData.activityRatings.map((rating) =>
            this.activityScoreRepository.create({
              forecastId: upsertedForecast.id,
              activity: rating.activity,
              score: rating.score,
              scoreText: rating.scoreText,
              reasoning: rating.reasoning,
            }),
          );

          if (activityScoreEntities.length > 0) {
            upsertedForecast.activityScores =
              await this.activityScoreRepository.upsertActivityScores(
                activityScoreEntities,
                manager,
              );
          }
        } else {
          upsertedForecast.activityScores ??= [];
        }

        savedForecasts.push(upsertedForecast);
      }

      return savedForecasts;
    });

    // Invalidate after commit so readers cannot re-cache pre-commit data.
    if (anyUpdated) {
      await this.forecastRepository.invalidateCity(cityId);
    }

    return savedForecasts;
  }

  async getStoredForecast(cityId: string, days: number = 7): Promise<Forecast[]> {
    return this.forecastRepository.getRecentForecastByCity(cityId, days);
  }


  async isForecastFresh(cityId: string, maxAgeHours: number = 1): Promise<boolean> {
    const latestFetch = await this.forecastRepository.getLatestFetchTimeForCity(
      cityId,
    );
    if (!latestFetch) {
      return false;
    }

    const now = new Date();
    const ageMinutes = (now.getTime() - latestFetch.getTime()) / (1000 * 60);
    return ageMinutes <= maxAgeHours * 60;
  }

}
