import { describe, expect, it } from '@jest/globals';
import { ActivityScorerService } from '../../../../src/module/weather/services/activity-scorer.service';

const baseWeather = {
  temperature_2m_max: 20,
  temperature_2m_min: 10,
  temperature_2m_mean: 15,
  precipitation_sum: 0,
  snowfall_sum: 0,
  wind_speed_10m_max: 10,
  wind_gusts_10m_max: 20,
  uv_index_max: 2,
  sunshine_duration: 9000,
  precipitation_probability_max: 20,
};

const weather = (overrides: Partial<typeof baseWeather> = {}) => ({
  ...baseWeather,
  ...overrides,
});

describe('ActivityScorerService', () => {
  const service = new ActivityScorerService();

  describe('skiing', () => {
    it.each([
      {
        name: 'rewards ideal temperature, powder, and likely snow',
        input: weather({
          temperature_2m_mean: -3,
          snowfall_sum: 20,
          wind_gusts_10m_max: 20,
          precipitation_probability_max: 80,
        }),
        reasons: ['ideal for skiing', 'excellent, fresh powder', 'likely snow'],
      },
      {
        name: 'penalizes dangerous cold, missing snow, and severe gusts',
        input: weather({
          temperature_2m_mean: -20,
          snowfall_sum: 0,
          wind_gusts_10m_max: 55,
        }),
        reasons: ['too cold', 'no new snow', 'dangerous conditions'],
      },
      {
        name: 'handles acceptable temperature, good snow, and challenging gusts',
        input: weather({
          temperature_2m_mean: 3,
          snowfall_sum: 10,
          wind_gusts_10m_max: 45,
        }),
        reasons: ['acceptable', 'good conditions', 'challenging'],
      },
      {
        name: 'penalizes warm conditions while recognizing light snow',
        input: weather({
          temperature_2m_mean: 10,
          snowfall_sum: 2,
          wind_gusts_10m_max: 30,
          precipitation_probability_max: 71,
        }),
        reasons: ['too warm', 'some fresh snow', 'good conditions', 'likely snow'],
      },
    ])('$name', ({ input, reasons }) => {
      const result = service.scoreSkiing(input);

      for (const reason of reasons) {
        expect(result.reasoning.join(' ')).toContain(reason);
      }
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(10);
    });
  });

  describe('surfing', () => {
    it.each([
      {
        name: 'rewards ideal waves, warm weather, and high UV',
        input: weather({
          wind_speed_10m_max: 20,
          temperature_2m_mean: 24,
          precipitation_probability_max: 61,
          uv_index_max: 7,
        }),
        reasons: ['ideal for wave generation', 'storm activity', 'comfortable', 'high sun'],
      },
      {
        name: 'recognizes good but strong wind and cold water',
        input: weather({
          wind_speed_10m_max: 30,
          temperature_2m_mean: 10,
          precipitation_probability_max: 60,
          uv_index_max: 6,
        }),
        reasons: ['good, but strong winds', 'cold, wetsuit required'],
      },
      {
        name: 'penalizes hazardous wind and cold conditions',
        input: weather({
          wind_speed_10m_max: 36,
          temperature_2m_mean: 14,
          precipitation_probability_max: 61,
          uv_index_max: 10,
        }),
        reasons: ['too strong, hazardous', 'storm activity', 'wetsuit required'],
      },
      {
        name: 'penalizes weak wind and leaves middle-range conditions neutral',
        input: weather({ wind_speed_10m_max: 5, temperature_2m_mean: 17 }),
        reasons: ['too weak, flat waves'],
      },
    ])('$name', ({ input, reasons }) => {
      const result = service.scoreSurfing(input);

      for (const reason of reasons) {
        expect(result.reasoning.join(' ')).toContain(reason);
      }
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(10);
    });
  });

  describe('outdoor sightseeing', () => {
    it.each([
      {
        name: 'rewards sunny, mild, calm conditions',
        input: weather({
          temperature_2m_mean: 20,
          precipitation_probability_max: 0,
          wind_speed_10m_max: 5,
          sunshine_duration: 18000,
          uv_index_max: 7,
        }),
        reasons: ['excellent visibility', 'very unlikely', 'ideal for outdoor', 'calm, pleasant', 'use sunscreen'],
      },
      {
        name: 'gives moderate credit to decent sun and low rain risk',
        input: weather({
          temperature_2m_mean: 27,
          precipitation_probability_max: 20,
          wind_speed_10m_max: 20,
          sunshine_duration: 9000,
        }),
        reasons: ['decent visibility', 'low risk'],
      },
      {
        name: 'penalizes low sun, likely rain, extreme cold, and strong wind',
        input: weather({
          temperature_2m_mean: 5,
          precipitation_probability_max: 80,
          wind_speed_10m_max: 35,
          sunshine_duration: 0,
          uv_index_max: 10,
        }),
        reasons: ['limited sun', 'likely rain', 'extreme conditions', 'strong, uncomfortable'],
      },
      {
        name: 'handles the neutral thresholds and elevated UV',
        input: weather({
          temperature_2m_mean: 31,
          precipitation_probability_max: 50,
          wind_speed_10m_max: 15,
          sunshine_duration: 7200,
          uv_index_max: 5,
        }),
        reasons: ['limited sun', 'extreme conditions', 'use sunscreen'],
      },
    ])('$name', ({ input, reasons }) => {
      const result = service.scoreOutdoorSightseeing(input);

      for (const reason of reasons) {
        expect(result.reasoning.join(' ')).toContain(reason);
      }
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(10);
    });
  });

  describe('indoor sightseeing', () => {
    it.each([
      {
        name: 'strongly recommends indoor activities for rain and cold',
        input: weather({
          precipitation_probability_max: 80,
          temperature_2m_mean: -1,
          wind_gusts_10m_max: 41,
        }),
        reasons: ['perfect for indoor alternatives', 'very cold', 'uncomfortable outside'],
      },
      {
        name: 'accounts for moderate rain and extreme heat',
        input: weather({
          precipitation_probability_max: 50,
          temperature_2m_mean: 35,
          sunshine_duration: 0,
          wind_gusts_10m_max: 40,
        }),
        reasons: ['some rain expected', 'very hot'],
      },
      {
        name: 'lowers indoor preference when outdoor weather is beautiful',
        input: weather({
          precipitation_probability_max: 0,
          temperature_2m_mean: 20,
          sunshine_duration: 18001,
          wind_gusts_10m_max: 40,
        }),
        reasons: ['Beautiful weather outside', 'always available'],
      },
      {
        name: 'keeps ordinary weather neutral for indoor activities',
        input: weather({
          precipitation_probability_max: 40,
          temperature_2m_mean: 32,
          sunshine_duration: 14400,
          wind_gusts_10m_max: 40,
        }),
        reasons: ['always available'],
      },
    ])('$name', ({ input, reasons }) => {
      const result = service.scoreIndoorSightseeing(input);

      for (const reason of reasons) {
        expect(result.reasoning.join(' ')).toContain(reason);
      }
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(10);
    });
  });

  it('scores all four activities in the public response order', () => {
    expect(service.scoreAllActivities(baseWeather).map(({ activity }) => activity)).toEqual([
      'Skiing',
      'Surfing',
      'Outdoor Sightseeing',
      'Indoor Sightseeing',
    ]);
  });
});