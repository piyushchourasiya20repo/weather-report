import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ForecastUpdateService } from './scheduler/services/forecast-update.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly forecastUpdateService: ForecastUpdateService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Run the scheduled update on demand instead of waiting for the next cron tick.
  @Post('test/update-forecasts')
  async triggerForecastUpdate(): Promise<{
    success: boolean;
    message: string;
    citiesUpdated: number;
    timestamp: string;
  }> {
    return await this.forecastUpdateService.triggerManualUpdate();
  }
}
