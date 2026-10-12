import { Injectable } from '@nestjs/common';
import { ActivityScore } from '../dto/weather.dto';
import { TIME_CONSTANTS } from '../../../constants';

interface WeatherMetrics {
  temperature_2m_max: number;
  temperature_2m_min: number;
  temperature_2m_mean: number;
  precipitation_sum: number;
  snowfall_sum: number;
  wind_speed_10m_max: number;
  wind_gusts_10m_max: number;
  uv_index_max: number;
  sunshine_duration: number;
  precipitation_probability_max: number;
}

@Injectable()
export class ActivityScorerService {
  /** Skiing favors fresh snow, cold temperatures, and manageable wind. */
  scoreSkiing(weather: WeatherMetrics): ActivityScore {
    const reasoning: string[] = [];
    let score = 5;

    // Cold, but not extreme, temperatures make for better ski conditions.
    if (weather.temperature_2m_mean < -15) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (too cold, avalanche risk)`,
      );
      score = Math.min(score, 2);
    } else if (
      weather.temperature_2m_mean >= -5 &&
      weather.temperature_2m_mean <= 0
    ) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (ideal for skiing)`,
      );
      score += 3;
    } else if (weather.temperature_2m_mean > 5) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (too warm, poor snow conditions)`,
      );
      score = Math.min(score, 2);
    } else {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (acceptable)`,
      );
      score += 1;
    }

    // Recent snowfall improves the score; no new snow lowers it slightly.
    if (weather.snowfall_sum > 15) {
      reasoning.push(
        `Snowfall: ${weather.snowfall_sum}cm (excellent, fresh powder)`,
      );
      score += 3;
    } else if (weather.snowfall_sum > 5) {
      reasoning.push(`Snowfall: ${weather.snowfall_sum}cm (good conditions)`);
      score += 2;
    } else if (weather.snowfall_sum > 0) {
      reasoning.push(`Snowfall: ${weather.snowfall_sum}cm (some fresh snow)`);
      score += 1;
    } else {
      reasoning.push(`Snowfall: ${weather.snowfall_sum}cm (no new snow)`);
      score = Math.max(1, score - 1);
    }

    // Strong gusts can make skiing unsafe.
    if (weather.wind_gusts_10m_max > 50) {
      reasoning.push(
        `Wind gusts: ${weather.wind_gusts_10m_max}km/h (dangerous conditions)`,
      );
      score = Math.min(score, 2);
    } else if (weather.wind_gusts_10m_max > 40) {
      reasoning.push(
        `Wind gusts: ${weather.wind_gusts_10m_max}km/h (challenging)`,
      );
      score = Math.max(1, score - 2);
    } else if (weather.wind_gusts_10m_max <= 30) {
      reasoning.push(
        `Wind gusts: ${weather.wind_gusts_10m_max}km/h (good conditions)`,
      );
      score += 1;
    }

    // Likely precipitation can bring fresh snow.
    if (weather.precipitation_probability_max > 70) {
      reasoning.push(
        `Precipitation probability: ${weather.precipitation_probability_max}% (likely snow)`,
      );
      score += 1;
    }

    return {
      activity: 'Skiing',
      score: Math.max(1, Math.min(10, Math.round(score))),
      scoreText: this.getScoreText(
        Math.max(1, Math.min(10, Math.round(score))),
      ),
      reasoning,
    };
  }

  /** Surfing uses wind as a rough proxy for swell and also considers comfort. */
  scoreSurfing(weather: WeatherMetrics): ActivityScore {
    const reasoning: string[] = [];
    let score = 5;

    // Moderate wind can help create waves; very strong wind is hazardous.
    if (weather.wind_speed_10m_max >= 15 && weather.wind_speed_10m_max <= 25) {
      reasoning.push(
        `Wind speed: ${weather.wind_speed_10m_max}km/h (ideal for wave generation)`,
      );
      score += 3;
    } else if (
      weather.wind_speed_10m_max > 25 &&
      weather.wind_speed_10m_max <= 35
    ) {
      reasoning.push(
        `Wind speed: ${weather.wind_speed_10m_max}km/h (good, but strong winds)`,
      );
      score += 2;
    } else if (weather.wind_speed_10m_max > 35) {
      reasoning.push(
        `Wind speed: ${weather.wind_speed_10m_max}km/h (too strong, hazardous)`,
      );
      score = Math.max(1, score - 2);
    } else if (weather.wind_speed_10m_max < 10) {
      reasoning.push(
        `Wind speed: ${weather.wind_speed_10m_max}km/h (too weak, flat waves)`,
      );
      score = Math.max(1, score - 1);
    }

    // Stormy weather can bring waves, though it may also make conditions rough.
    if (weather.precipitation_probability_max > 60) {
      reasoning.push(
        `Precipitation: ${weather.precipitation_probability_max}% (storm activity generates waves)`,
      );
      score += 1;
    }

    // Air temperature affects comfort, though surfers can dress for colder weather.
    if (
      weather.temperature_2m_mean >= 20 &&
      weather.temperature_2m_mean <= 28
    ) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (comfortable)`,
      );
      score += 1;
    } else if (weather.temperature_2m_mean < 15) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (cold, wetsuit required)`,
      );
      score = Math.max(1, score - 1);
    }

    // UV exposure matters even when it only changes the score slightly.
    if (weather.uv_index_max > 6) {
      reasoning.push(
        `UV index: ${weather.uv_index_max} (high sun, wear protection)`,
      );
      score += 0.5;
    }

    return {
      activity: 'Surfing',
      score: Math.max(1, Math.min(10, Math.round(score))),
      scoreText: this.getScoreText(
        Math.max(1, Math.min(10, Math.round(score))),
      ),
      reasoning,
    };
  }

  /** Outdoor sightseeing favors sun, mild temperatures, and low rain risk. */
  scoreOutdoorSightseeing(weather: WeatherMetrics): ActivityScore {
    const reasoning: string[] = [];
    let score = 5;

    // More daylight makes sightseeing easier.
    if (weather.sunshine_duration > 14400) {
      reasoning.push(
        `Sunshine: ${Math.round(weather.sunshine_duration / TIME_CONSTANTS.SECONDS_PER_HOUR)}h (excellent visibility)`,
      );
      score += 3;
    } else if (weather.sunshine_duration > 7200) {
      reasoning.push(
        `Sunshine: ${Math.round(weather.sunshine_duration / TIME_CONSTANTS.SECONDS_PER_HOUR)}h (decent visibility)`,
      );
      score += 2;
    } else {
      reasoning.push(
        `Sunshine: ${Math.round(weather.sunshine_duration / TIME_CONSTANTS.SECONDS_PER_HOUR)}h (limited sun)`,
      );
      score = Math.max(1, score - 1);
    }

    // Rain is one of the biggest drawbacks for outdoor plans.
    if (weather.precipitation_probability_max < 10) {
      reasoning.push(
        `Rain probability: ${weather.precipitation_probability_max}% (very unlikely)`,
      );
      score += 2;
    } else if (weather.precipitation_probability_max < 30) {
      reasoning.push(
        `Rain probability: ${weather.precipitation_probability_max}% (low risk)`,
      );
      score += 1;
    } else if (weather.precipitation_probability_max > 70) {
      reasoning.push(
        `Rain probability: ${weather.precipitation_probability_max}% (likely rain)`,
      );
      score = Math.max(1, score - 2);
    }

    // Comfortable temperatures help; extremes lower the score.
    if (
      weather.temperature_2m_mean >= 15 &&
      weather.temperature_2m_mean <= 25
    ) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (ideal for outdoor activities)`,
      );
      score += 2;
    } else if (
      weather.temperature_2m_mean < 10 ||
      weather.temperature_2m_mean > 30
    ) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (extreme conditions)`,
      );
      score = Math.max(1, score - 1);
    }

    // Strong wind makes time outdoors less pleasant.
    if (weather.wind_speed_10m_max < 15) {
      reasoning.push(
        `Wind: ${weather.wind_speed_10m_max}km/h (calm, pleasant)`,
      );
      score += 1;
    } else if (weather.wind_speed_10m_max > 30) {
      reasoning.push(
        `Wind: ${weather.wind_speed_10m_max}km/h (strong, uncomfortable)`,
      );
      score = Math.max(1, score - 1);
    }

    // Recommend sun protection when UV is elevated.
    if (weather.uv_index_max >= 5 && weather.uv_index_max <= 9) {
      reasoning.push(
        `UV index: ${weather.uv_index_max} (good sun exposure, use sunscreen)`,
      );
      score += 0.5;
    }

    return {
      activity: 'Outdoor Sightseeing',
      score: Math.max(1, Math.min(10, Math.round(score))),
      scoreText: this.getScoreText(
        Math.max(1, Math.min(10, Math.round(score))),
      ),
      reasoning,
    };
  }

  /** Indoor sightseeing scores higher when poor weather makes outdoor plans less appealing. */
  scoreIndoorSightseeing(weather: WeatherMetrics): ActivityScore {
    const reasoning: string[] = [];
    let score = 7;

    // Rain makes indoor plans a more attractive alternative.
    if (weather.precipitation_probability_max > 70) {
      reasoning.push(
        `Rain probability: ${weather.precipitation_probability_max}% (perfect for indoor alternatives)`,
      );
      score += 2;
    } else if (weather.precipitation_probability_max > 40) {
      reasoning.push(
        `Rain probability: ${weather.precipitation_probability_max}% (some rain expected)`,
      );
      score += 1;
    }

    // Extreme temperatures are easier to avoid indoors.
    if (weather.temperature_2m_mean < 0) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (very cold, indoor is comfortable)`,
      );
      score += 1;
    } else if (weather.temperature_2m_mean > 32) {
      reasoning.push(
        `Temperature: ${weather.temperature_2m_mean}°C (very hot, indoor is cooler)`,
      );
      score += 1;
    }

    // Good outdoor weather makes indoor activities less appealing.
    if (
      weather.sunshine_duration > 14400 &&
      weather.precipitation_probability_max < 20
    ) {
      reasoning.push(
        `Beautiful weather outside (sunshine: ${Math.round(weather.sunshine_duration / TIME_CONSTANTS.SECONDS_PER_HOUR)}h)`,
      );
      score = Math.max(1, score - 2);
    }

    // Strong gusts are another reason to stay inside.
    if (weather.wind_gusts_10m_max > 40) {
      reasoning.push(
        `Wind gusts: ${weather.wind_gusts_10m_max}km/h (uncomfortable outside)`,
      );
      score += 1;
    }

    reasoning.push(
      'Indoor activities are always available regardless of weather',
    );

    return {
      activity: 'Indoor Sightseeing',
      score: Math.max(1, Math.min(10, Math.round(score))),
      scoreText: this.getScoreText(
        Math.max(1, Math.min(10, Math.round(score))),
      ),
      reasoning,
    };
  }

  scoreAllActivities(weather: WeatherMetrics): ActivityScore[] {
    return [
      this.scoreSkiing(weather),
      this.scoreSurfing(weather),
      this.scoreOutdoorSightseeing(weather),
      this.scoreIndoorSightseeing(weather),
    ];
  }

  private getScoreText(score: number): string {
    if (score === 10) return 'Perfect';
    if (score >= 9) return 'Excellent';
    if (score >= 7) return 'Good';
    if (score >= 5) return 'Moderate';
    if (score >= 3) return 'Poor';
    return 'Avoid';
  }
}
