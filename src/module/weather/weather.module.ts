import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherResolver } from './weather.resolver';
import { WeatherService } from './weather.service';
import { ActivityScorerService } from './services/activity-scorer.service';
import { ForecastPersistenceService } from './services/forecast-persistence.service';
import { RedisCacheService } from '../../integration/redis-cache.service';
import { ForecastRepository } from './repositories/forecast.repository';
import { ActivityScoreRepository } from './repositories/activity-score.repository';
import { Forecast } from './entities/forecast.entity';
import { ActivityScore } from './entities/activity-score.entity';
import { IntegrationModule } from '../../integration/integration.module';

@Module({
  imports: [TypeOrmModule.forFeature([Forecast, ActivityScore]), IntegrationModule],
  providers: [
    WeatherResolver,
    WeatherService,
    ActivityScorerService,
    ForecastPersistenceService,
    RedisCacheService,
    ForecastRepository,
    ActivityScoreRepository,
  ],
  exports: [
    WeatherService,
    ForecastPersistenceService,
    RedisCacheService,
  ],
})
export class WeatherModule {}
