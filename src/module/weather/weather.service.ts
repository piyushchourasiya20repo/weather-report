import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ActivityMatrix, DailyActivityRatings } from './dto/weather.dto';
import { OpenMeteoService } from '../../integration/open-meteo.service';
import { ActivityScorerService } from './services/activity-scorer.service';
import { ForecastPersistenceService } from './services/forecast-persistence.service';
import { RedisCacheService } from '../../integration/redis-cache.service';
import { CityRepository } from './repositories/city.repository';
import { CACHE_KEYS } from '../../constants';

@Injectable()
export class WeatherService {
  constructor(
    @InjectPinoLogger(WeatherService.name)
    private readonly logger: PinoLogger,
    private readonly openMeteoService: OpenMeteoService,
    private readonly activityScorerService: ActivityScorerService,
    private readonly forecastPersistenceService: ForecastPersistenceService,
    private readonly cityRepository: CityRepository,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  /** Fetch, score, and save a forecast for either a request or scheduled refresh. */
  async fetchAndStoreForecast(
    caller: 'API' | 'SCHEDULER',
    cityId: string,
    latitude: number,
    longitude: number,
    geoData: any,
  ): Promise<ActivityMatrix | null> {
    try {
      const fetchedAt = new Date();
      const forecastData = await this.openMeteoService.getForecast(
        latitude,
        longitude,
        7,
      );

      if (!forecastData) {
        this.logger.warn(
          `[${caller}] Could not fetch forecast for city at coordinates (${latitude}, ${longitude})`,
        );
        return null;
      }

      const activityMatrix = this.buildActivityMatrix(geoData, forecastData);

      const forecastDataToStore = activityMatrix.forecast.map((daily) => ({
        date: daily.date,
        temperature_2m_max: daily.temperature2mMax,
        temperature_2m_min: daily.temperature2mMin,
        temperature_2m_mean: daily.temperature2mMean,
        precipitation_sum: daily.precipitationSum,
        precipitation_probability_max: daily.precipitationProbabilityMax,
        snowfall_sum: daily.snowfallSum,
        rain_sum: daily.rainSum,
        wind_speed_10m_max: daily.windSpeed10mMax,
        wind_gusts_10m_max: daily.windGusts10mMax,
        uv_index_max: daily.uvIndexMax,
        sunshine_duration: daily.sunshineDuration,
        condition: daily.condition,
        activityRatings: daily.activityRatings,
      }));

      await this.forecastPersistenceService.storeForecastData(
        cityId,
        forecastDataToStore,
        fetchedAt,
      );

      this.logger.info(
        {
          caller,
          cityName: geoData.name,
          forecastDays: forecastDataToStore.length,
        },
        'Stored forecast data',
      );

      return activityMatrix;
    } catch (error) {
      this.logger.error(
        { err: error, caller, cityName: geoData.name },
        'Failed to fetch and store forecast',
      );
      throw error;
    }
  }

  async weatherByCityHelper(
    cityName: string,
    caller: 'API' | 'SCHEDULER',
  ): Promise<ActivityMatrix | null> {
    const geoData = await this.openMeteoService.getCoordinates(cityName);
    if (!geoData) {
      return null;
    }

    let city = await this.cityRepository.findByName(geoData.name);
    if (!city) {
      this.logger.info({ cityName: geoData.name }, 'Saving new city');
      city = await this.cityRepository.save(
        geoData.name,
        geoData.latitude,
        geoData.longitude,
      );
    }
    

    const isFresh = await this.forecastPersistenceService.isForecastFresh(
      city.id,
      caller === 'API' ? 6 : 3, // hours of freshness required depending on the caller 
    );

    let activityMatrix;

    if (isFresh) {
      if (caller === 'SCHEDULER') {
        this.logger.debug(
          { caller, cityName: geoData.name },
          'Skipping refresh because forecast is fresh',
        );
        return null;
      }
      this.logger.debug(
        { caller, cityName: geoData.name },
        'Using stored forecast',
      );
      const storedForecasts =
        await this.forecastPersistenceService.getStoredForecast(city.id, 7);

      if (storedForecasts && storedForecasts.length > 0) {
        activityMatrix = this.buildActivityMatrixFromStoredData(
          geoData,
          storedForecasts,
        );
        return activityMatrix;
      }
    }

    this.logger.info(
      { caller, cityName: geoData.name },
      'Fetching a fresh forecast',
    );
    activityMatrix = await this.fetchAndStoreForecast(
      caller,
      city.id,
      geoData.latitude,
      geoData.longitude,
      geoData,
    );
    await this.redisCacheService.delete(`city:searches:${geoData.name}`);
    await this.redisCacheService.delete(CACHE_KEYS.weather(geoData.name));
    return activityMatrix;
  }

  async getWeatherByCity(cityName: string): Promise<ActivityMatrix | null> {
    const searchKey = `city:searches:${cityName}`;
    const cacheKey = CACHE_KEYS.weather(cityName);
    const cached = await this.redisCacheService.get<ActivityMatrix>(cacheKey);
    if (cached) {
      // Cache hits still count toward scheduler popularity.
      await this.redisCacheService.incrementKey(searchKey);
      return cached;
    }

    const weather = await this.weatherByCityHelper(cityName, 'API');
    await this.redisCacheService.incrementKey(searchKey);
    if (weather) {
      await this.redisCacheService.set(cacheKey, weather);
    }

    return weather;
  }

  private buildActivityMatrix(geoData: any, forecastData: any): ActivityMatrix {
    const dailyData = forecastData.daily;
    const forecast: DailyActivityRatings[] = [];

    for (let i = 0; i < Math.min(7, dailyData.temperature_2m_max.length); i++) {
      // Fall back to a calculated date if the API response has none.
      const date = forecastData.daily.time?.[i] || this.getDateString(i);

      const temp_mean =
        (dailyData.temperature_2m_max[i] + dailyData.temperature_2m_min[i]) / 2;

      const weatherMetrics = {
        temperature_2m_max: dailyData.temperature_2m_max[i],
        temperature_2m_min: dailyData.temperature_2m_min[i],
        temperature_2m_mean: temp_mean,
        precipitation_sum: dailyData.precipitation_sum[i],
        snowfall_sum: dailyData.snowfall_sum[i],
        wind_speed_10m_max: dailyData.wind_speed_10m_max[i],
        wind_gusts_10m_max: dailyData.wind_gusts_10m_max[i],
        uv_index_max: dailyData.uv_index_max[i],
        sunshine_duration: dailyData.sunshine_duration[i],
        precipitation_probability_max:
          dailyData.precipitation_probability_max[i],
      };

      const activityRatings =
        this.activityScorerService.scoreAllActivities(weatherMetrics);

      const condition = this.getWeatherCondition(dailyData.weather_code[i]);

      const dailyRating: DailyActivityRatings = {
        date,
        temperature2mMax: dailyData.temperature_2m_max[i],
        temperature2mMin: dailyData.temperature_2m_min[i],
        temperature2mMean: temp_mean,
        precipitationSum: dailyData.precipitation_sum[i],
        snowfallSum: dailyData.snowfall_sum[i],
        rainSum: dailyData.rain_sum[i],
        windSpeed10mMax: dailyData.wind_speed_10m_max[i],
        windGusts10mMax: dailyData.wind_gusts_10m_max[i],
        uvIndexMax: dailyData.uv_index_max[i],
        sunshineDuration: dailyData.sunshine_duration[i],
        precipitationProbabilityMax: dailyData.precipitation_probability_max[i],
        condition,
        activityRatings,
      };

      forecast.push(dailyRating);
    }

    return {
      city: geoData.name,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      forecast,
    };
  }

  /** Rebuild the response from stored forecasts without recalculating scores. */
  private buildActivityMatrixFromStoredData(
    geoData: any,
    storedForecasts: any[],
  ): ActivityMatrix {
    const forecast: DailyActivityRatings[] = storedForecasts.map((stored) => {
      const activityRatings = (stored.activityScores || []).map(
        (score: any) => ({
          activity: score.activity,
          score: Number(score.score),
          scoreText: score.scoreText,
          reasoning: score.reasoning || [],
        }),
      );

      return {
        date: new Date(stored.forecastDate).toISOString().split('T')[0],
        temperature2mMax: Number(stored.temperature2mMax),
        temperature2mMin: Number(stored.temperature2mMin),
        temperature2mMean: Number(stored.temperature2mMean),
        precipitationSum: Number(stored.precipitationSum),
        snowfallSum: Number(stored.snowfallSum),
        rainSum: Number(stored.rainSum),
        windSpeed10mMax: Number(stored.windSpeed10mMax),
        windGusts10mMax: Number(stored.windGusts10mMax),
        uvIndexMax: Number(stored.uvIndexMax),
        sunshineDuration: Number(stored.sunshineDuration),
        precipitationProbabilityMax: Number(stored.precipitationProbabilityMax),
        condition: stored.condition,
        activityRatings,
      };
    });

    return {
      city: geoData.name,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      forecast,
    };
  }

  private getWeatherCondition(code: number): string {
    const conditions: { [key: number]: string } = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };
    return conditions[code] || 'Unknown';
  }

  private getDateString(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }
}
