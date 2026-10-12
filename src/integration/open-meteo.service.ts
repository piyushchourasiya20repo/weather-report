import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QueryFailedError } from 'typeorm';
import { OPEN_METEO_CONSTANTS } from '../constants';
import { env } from '../config/env';
import { CityRepository } from '../module/weather/repositories/city.repository';

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

interface ForecastResult {
  latitude: number;
  longitude: number;
  daily: {
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    sunrise: string[];
    sunset: string[];
    daylight_duration: number[];
    sunshine_duration: number[];
    uv_index_max: number[];
    rain_sum: number[];
    showers_sum: number[];
    snowfall_sum: number[];
    precipitation_sum: number[];
    precipitation_hours: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
  };
}

@Injectable()
export class OpenMeteoService {
  constructor(
    @InjectPinoLogger(OpenMeteoService.name)
    private readonly logger: PinoLogger,
    private readonly cityRepository: CityRepository,
  ) {}

  async getCoordinates(cityName: string): Promise<GeocodingResult | null> {
    const cachedCity = await this.cityRepository.findByName(cityName);
    if (cachedCity) {
      this.logger.debug({ cityName }, 'Using stored city coordinates');
      return {
        name: cachedCity.name,
        latitude: Number(cachedCity.latitude),
        longitude: Number(cachedCity.longitude),
      };
    }

    this.logger.debug({ cityName }, 'Looking up city coordinates');
    let results: GeocodingResult[] | undefined;
    try {
      const response = await axios.get<{ results: GeocodingResult[] }>(
        env.OPEN_METEO_GEOCODING_API_URL,
        {
          params: {
            name: cityName,
            count: OPEN_METEO_CONSTANTS.GEOCODING_RESULT_COUNT,
            language: OPEN_METEO_CONSTANTS.LANGUAGE,
            format: OPEN_METEO_CONSTANTS.RESPONSE_FORMAT,
          },
        },
      );
      results = response.data.results;
    } catch (error) {
      this.logger.error({ err: error, cityName }, 'Geocoding request failed');
      throw new ServiceUnavailableException('City lookup is temporarily unavailable');
    }

    const geoResult = results?.[0];
    if (!geoResult) {
      return null;
    }

    try {
      await this.cityRepository.save(
        geoResult.name,
        geoResult.latitude,
        geoResult.longitude,
      );
      this.logger.info({ cityName: geoResult.name }, 'Stored city coordinates');
      return geoResult;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        const existingCity = await this.cityRepository.findByName(geoResult.name);
        if (existingCity) {
          return {
            name: existingCity.name,
            latitude: Number(existingCity.latitude),
            longitude: Number(existingCity.longitude),
          };
        }
      }

      this.logger.error(
        { err: error, cityName: geoResult.name },
        'Failed to store city coordinates',
      );
      throw error;
    }
  }

  async getForecast(
    latitude: number,
    longitude: number,
    forecastDays: number = OPEN_METEO_CONSTANTS.DEFAULT_FORECAST_DAYS,
  ): Promise<ForecastResult | null> {
    try {
      const response = await axios.get<ForecastResult>(
        env.OPEN_METEO_FORECAST_API_URL,
        {
          params: {
            latitude,
            longitude,
            daily: OPEN_METEO_CONSTANTS.DAILY_FIELDS,
            forecast_days: forecastDays,
            timezone: OPEN_METEO_CONSTANTS.TIMEZONE,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        { err: error, latitude, longitude },
        'Forecast request failed',
      );
      throw new ServiceUnavailableException('Weather data is temporarily unavailable');
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }
}
