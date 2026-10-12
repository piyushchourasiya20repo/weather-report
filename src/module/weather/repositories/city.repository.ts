import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../entities/city.entity';

@Injectable()
export class CityRepository {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  async findByName(cityName: string): Promise<City | null> {
    return this.cityRepository.findOne({ where: { name: cityName } });
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
      return await this.cityRepository.save(city);
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
