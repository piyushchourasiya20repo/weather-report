import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../entities/city.entity';
import { RedisCacheService } from '../../../integration/redis-cache.service';
import { CACHE_CONSTANTS, CACHE_KEYS } from '../../../constants';

@Injectable()
export class CityRepository {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async findByName(cityName: string): Promise<City | null> {
    const cacheKey = CACHE_KEYS.city(cityName);
    const cached = await this.redisCacheService.get<City>(cacheKey);
    if (cached) {
      return cached;
    }

    const city = await this.cityRepository.findOne({ where: { name: cityName } });
    if (city) {
      await this.redisCacheService.set(
        cacheKey,
        city,
        CACHE_CONSTANTS.CITY_TTL_SECONDS,
      );
    }
    return city;
  }

  async save(
    name: string,
    latitude: number,
    longitude: number,
  ): Promise<City> {
    const city = this.cityRepository.create({
      name,
      latitude,
      longitude,
    });
    try {
      const savedCity = await this.cityRepository.save(city);
      await this.redisCacheService.set(
        CACHE_KEYS.city(name),
        savedCity,
        CACHE_CONSTANTS.CITY_TTL_SECONDS,
      );
      return savedCity;
    } catch (error) {
      const queryError = error as {
        code?: string;
        driverError?: { code?: string };
      };
      const errorCode = queryError.driverError?.code ?? queryError.code;

      if (errorCode !== '23505') {
        throw error;
      }

      const existingCity = await this.findByName(name);
      if (!existingCity) {
        throw error;
      }

      return existingCity;
    }
  }
}
