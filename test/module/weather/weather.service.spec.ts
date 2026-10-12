import { describe, expect, it, jest } from '@jest/globals';
import { ActivityScorerService } from '../../../src/module/weather/services/activity-scorer.service';
import { WeatherService } from '../../../src/module/weather/weather.service';

const geoData = {
  name: 'Example City',
  latitude: 12.5,
  longitude: 34.5,
};

const forecastResponse = {
  daily: {
    time: [
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ],
    temperature_2m_max: [20, 20, 20, 20, 20, 20, 20],
    temperature_2m_min: [10, 10, 10, 10, 10, 10, 10],
    precipitation_sum: [0, 0, 0, 0, 0, 0, 0],
    precipitation_probability_max: [0, 0, 0, 0, 0, 0, 0],
    snowfall_sum: [0, 0, 0, 0, 0, 0, 0],
    rain_sum: [0, 0, 0, 0, 0, 0, 0],
    wind_speed_10m_max: [5, 5, 5, 5, 5, 5, 5],
    wind_gusts_10m_max: [8, 8, 8, 8, 8, 8, 8],
    uv_index_max: [2, 2, 2, 2, 2, 2, 2],
    sunshine_duration: [18000, 18000, 18000, 18000, 18000, 18000, 18000],
    weather_code: [0, 0, 0, 0, 0, 0, 0],
  },
};

const asyncMock = <T>() => jest.fn<() => Promise<T>>();

const createTestContext = () => {
  const city = { id: 'city-id', ...geoData };
  const dependencies = {
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    openMeteoService: {
      getCoordinates: asyncMock<typeof geoData | null>().mockResolvedValue(geoData),
      getForecast: asyncMock<typeof forecastResponse | null>().mockResolvedValue(
        forecastResponse,
      ),
    },
    activityScorerService: new ActivityScorerService(),
    forecastPersistenceService: {
      isForecastFresh: asyncMock<boolean>().mockResolvedValue(false),
      getStoredForecast: asyncMock<unknown[]>().mockResolvedValue([]),
      storeForecastData: asyncMock<unknown[]>().mockResolvedValue([]),
    },
    cityRepository: {
      findByName: asyncMock<typeof city | null>().mockResolvedValue(null),
      save: asyncMock<typeof city>().mockResolvedValue(city),
    },
    redisCacheService: {
      delete: asyncMock<void>().mockResolvedValue(undefined),
      incrementKey: asyncMock<number>().mockResolvedValue(1),
    },
  };
  const service = new WeatherService(
    dependencies.logger as any,
    dependencies.openMeteoService as any,
    dependencies.activityScorerService,
    dependencies.forecastPersistenceService as any,
    dependencies.cityRepository as any,
    dependencies.redisCacheService as any,
  );

  return { city, dependencies, service };
};

describe('WeatherService functional behavior', () => {
  it('geocodes, creates a city, scores a fresh forecast, persists it, and tracks the search', async () => {
    const { dependencies, service } = createTestContext();

    const result = await service.getWeatherByCity('Example');

    expect(result).toMatchObject({
      city: 'Example City',
      latitude: 12.5,
      longitude: 34.5,
    });
    expect(result?.forecast).toHaveLength(7);
    expect(result?.forecast[0]).toMatchObject({
      date: '2026-10-12',
      condition: 'Clear sky',
    });
    expect(result?.forecast[0].activityRatings).toHaveLength(4);
    expect(dependencies.cityRepository.save).toHaveBeenCalledWith(
      'Example City',
      12.5,
      34.5,
    );
    expect(dependencies.openMeteoService.getForecast).toHaveBeenCalledWith(
      12.5,
      34.5,
      7,
    );
    expect(dependencies.forecastPersistenceService.storeForecastData).toHaveBeenCalledWith(
      'city-id',
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-10-12', condition: 'Clear sky' }),
      ]),
      expect.any(Date),
    );
    expect(dependencies.redisCacheService.delete).toHaveBeenCalledWith(
      'city:searches:Example City',
    );
    expect(dependencies.redisCacheService.incrementKey).toHaveBeenCalledWith(
      'city:searches:Example',
    );
  });

  it('serves stored forecasts without calling the weather provider when data is fresh', async () => {
    const { city, dependencies, service } = createTestContext();
    const forecastDate = new Date('2026-10-12T00:00:00.000Z');
    dependencies.cityRepository.findByName.mockResolvedValue(city);
    dependencies.forecastPersistenceService.isForecastFresh.mockResolvedValue(
      true,
    );
    dependencies.forecastPersistenceService.getStoredForecast.mockResolvedValue(
      [
        {
          forecastDate,
          temperature2mMax: '20.00',
          temperature2mMin: '10.00',
          temperature2mMean: '15.00',
          precipitationSum: '0.00',
          snowfallSum: '0.00',
          rainSum: '0.00',
          windSpeed10mMax: '5.00',
          windGusts10mMax: '8.00',
          uvIndexMax: '2.00',
          sunshineDuration: '18000.00',
          precipitationProbabilityMax: '0.00',
          condition: 'Clear sky',
          activityScores: [
            {
              activity: 'Hiking',
              score: '8.0',
              scoreText: 'Good',
              reasoning: ['Comfortable weather'],
            },
          ],
        },
      ],
    );

    const result = await service.getWeatherByCity('Example');

    expect(result?.forecast).toHaveLength(1);
    expect(result?.forecast[0].temperature2mMax).toBe(20);
    expect(result?.forecast[0].activityRatings[0]).toEqual({
      activity: 'Hiking',
      score: 8,
      scoreText: 'Good',
      reasoning: ['Comfortable weather'],
    });
    expect(dependencies.openMeteoService.getForecast).not.toHaveBeenCalled();
    expect(dependencies.forecastPersistenceService.storeForecastData).not.toHaveBeenCalled();
    expect(dependencies.redisCacheService.incrementKey).toHaveBeenCalledWith(
      'city:searches:Example',
    );
  });

  it('returns null and still tracks the search when geocoding finds no city', async () => {
    const { dependencies, service } = createTestContext();
    dependencies.openMeteoService.getCoordinates.mockResolvedValue(null);

    await expect(service.getWeatherByCity('Unknown')).resolves.toBeNull();

    expect(dependencies.cityRepository.findByName).not.toHaveBeenCalled();
    expect(dependencies.openMeteoService.getForecast).not.toHaveBeenCalled();
    expect(dependencies.redisCacheService.incrementKey).toHaveBeenCalledWith(
      'city:searches:Unknown',
    );
  });

  it('returns null without persisting when the weather provider has no forecast', async () => {
    const { dependencies, service } = createTestContext();
    dependencies.openMeteoService.getForecast.mockResolvedValue(null);

    await expect(service.getWeatherByCity('Example')).resolves.toBeNull();

    expect(dependencies.forecastPersistenceService.storeForecastData).not.toHaveBeenCalled();
    expect(dependencies.redisCacheService.incrementKey).toHaveBeenCalledWith(
      'city:searches:Example',
    );
  });

  it('propagates provider errors without recording a completed search', async () => {
    const { dependencies, service } = createTestContext();
    const providerError = new Error('Weather provider unavailable');
    dependencies.openMeteoService.getForecast.mockRejectedValue(providerError);

    await expect(service.getWeatherByCity('Example')).rejects.toBe(providerError);

    expect(dependencies.logger.error).toHaveBeenCalled();
    expect(dependencies.redisCacheService.incrementKey).not.toHaveBeenCalled();
  });
});