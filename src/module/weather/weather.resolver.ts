import { Resolver, Query, Args } from '@nestjs/graphql';
import {
  ActivityMatrix,
} from './dto/weather.dto';
import { WeatherService } from './weather.service';

@Resolver(() => ActivityMatrix)
export class WeatherResolver {
  constructor(
    private readonly weatherService: WeatherService,
  ) {}

  @Query(() => ActivityMatrix, { nullable: true })
  async getWeather(@Args('city') city: string): Promise<ActivityMatrix | null> {
    return this.weatherService.getWeatherByCity(city);
  }
}
