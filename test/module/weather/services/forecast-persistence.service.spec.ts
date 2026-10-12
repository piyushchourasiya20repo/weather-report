import { describe, expect, it, jest } from '@jest/globals';
import { ForecastPersistenceService } from '../../../../src/module/weather/services/forecast-persistence.service';

const asyncMock = <T>() => jest.fn<() => Promise<T>>();

describe('ForecastPersistenceService', () => {
  const createForecastData = () => [
    {
      date: '2026-10-12',
      temperature_2m_max: 20,
      temperature_2m_min: 10,
      temperature_2m_mean: 15,
      precipitation_sum: 0,
      precipitation_probability_max: 0,
      snowfall_sum: 0,
      rain_sum: 0,
      wind_speed_10m_max: 5,
      wind_gusts_10m_max: 8,
      uv_index_max: 2,
      sunshine_duration: 100,
      condition: 'Clear',
      activityRatings: [
        { activity: 'hiking', score: 9, scoreText: 'Great', reasoning: [] },
      ],
    },
  ];

  const createService = (updated: boolean) => {
    const storedForecast = {
      id: 'forecast-id',
      activityScores: [{ activity: 'hiking', score: 8 }],
    };
    const forecastRepository = {
      create: jest.fn((value) => value),
      upsertForecastIfNewer: asyncMock<{
        forecast: typeof storedForecast;
        updated: boolean;
      }>().mockResolvedValue({ forecast: storedForecast, updated }),
    };
    const activityScoreRepository = {
      create: jest.fn((value) => value),
      upsertActivityScores: asyncMock<Array<{ activity: string; score: number }>>().mockResolvedValue([
        { activity: 'hiking', score: 9 },
      ]),
    };
    const dataSource = {
      transaction: jest.fn(
        (callback: (manager: object) => Promise<unknown>) => callback({}),
      ),
    };
    const service = new ForecastPersistenceService(
      dataSource as any,
      forecastRepository as any,
      activityScoreRepository as any,
    );

    return { service, activityScoreRepository, storedForecast };
  };

  it('does not overwrite activity scores when a stale forecast loses', async () => {
    const { service, activityScoreRepository, storedForecast } =
      createService(false);
    const result = await service.storeForecastData(
      'city-id',
      createForecastData(),
      new Date('2026-10-12T10:00:00Z'),
    );

    expect(activityScoreRepository.upsertActivityScores).not.toHaveBeenCalled();
    expect(result[0].activityScores).toEqual(storedForecast.activityScores);
  });

  it('updates activity scores when the incoming forecast wins', async () => {
    const { service, activityScoreRepository } = createService(true);

    const result = await service.storeForecastData(
      'city-id',
      createForecastData(),
      new Date('2026-10-12T10:00:00Z'),
    );

    expect(activityScoreRepository.upsertActivityScores).toHaveBeenCalledTimes(1);
    expect(result[0].activityScores).toEqual([
      { activity: 'hiking', score: 9 },
    ]);
  });
});