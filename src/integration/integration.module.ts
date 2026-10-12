import { Module } from '@nestjs/common';
import { OpenMeteoService } from './open-meteo.service';
import { RedisCacheService } from './redis-cache.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CityRepository } from '../module/weather/repositories/city.repository';
import { City } from '../module/weather/entities/city.entity';

@Module({
  imports: [TypeOrmModule.forFeature([City])],
  providers: [OpenMeteoService, RedisCacheService, CityRepository],
  exports: [OpenMeteoService, RedisCacheService, CityRepository],
})
export class IntegrationModule {}
