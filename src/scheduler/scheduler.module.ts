import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ForecastUpdateService } from './services/forecast-update.service';
import { WeatherModule } from '../module/weather/weather.module';
import { IntegrationModule } from '../integration/integration.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerRun } from './entities/scheduler-run.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([SchedulerRun]),
    WeatherModule,
    IntegrationModule,
  ],
  providers: [ForecastUpdateService],
  exports: [ForecastUpdateService],
})
export class SchedulerModule {}