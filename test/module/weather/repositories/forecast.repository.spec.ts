import { describe, expect, it, jest } from '@jest/globals';
import { ForecastRepository } from '../../../../src/module/weather/repositories/forecast.repository';

const asyncMock = <T>() => jest.fn<() => Promise<T>>();

describe('ForecastRepository', () => {
  const createRepository = (raw: unknown[]) => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: asyncMock<unknown[]>().mockResolvedValue([]),
      getOne: asyncMock<unknown | null>().mockResolvedValue(null),
      getRawOne: asyncMock<unknown>().mockResolvedValue(undefined),
      execute: asyncMock<{ raw: unknown[]; affected?: number }>().mockResolvedValue({ raw }),
    };
    const storedForecast = { id: 'forecast-id' };
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      findOne: asyncMock<typeof storedForecast>().mockResolvedValue(
        storedForecast,
      ),
    };
    const manager = { getRepository: jest.fn(() => repository) };
    const forecastRepository = new ForecastRepository({
      createEntityManager: jest.fn(() => ({})),
    } as any);
    jest
      .spyOn(forecastRepository, 'createQueryBuilder')
      .mockReturnValue(queryBuilder as any);

    return { forecastRepository, manager, queryBuilder, storedForecast };
  };

  it('upserts a forecast and reloads it with its activity scores', async () => {
    const { forecastRepository, storedForecast } = createRepository([]);
    const managerRepository = {
      upsert: jest.fn<(...args: any[]) => Promise<unknown>>().mockResolvedValue(undefined),
      findOne: asyncMock<typeof storedForecast | null>().mockResolvedValue(storedForecast),
    };
    const manager = { getRepository: jest.fn(() => managerRepository) };
    const forecastDate = new Date('2026-10-12T00:00:00.000Z');

    await expect(
      forecastRepository.upsertForecast(
        { cityId: 'city-id', forecastDate },
        manager as any,
      ),
    ).resolves.toBe(storedForecast);

    expect(managerRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ cityId: 'city-id', forecastDate, fetchedAt: expect.any(Date) }),
      ['cityId', 'forecastDate'],
    );
    expect(managerRepository.findOne).toHaveBeenCalledWith({
      where: { cityId: 'city-id', forecastDate },
      relations: { activityScores: true },
    });
  });

  it('throws when an upserted forecast cannot be reloaded', async () => {
    const { forecastRepository } = createRepository([]);
    const managerRepository = {
      upsert: jest.fn<(...args: any[]) => Promise<unknown>>().mockResolvedValue(undefined),
      findOne: asyncMock<null>().mockResolvedValue(null),
    };

    await expect(
      forecastRepository.upsertForecast(
        { cityId: 'city-id', forecastDate: new Date('2026-10-12') },
        { getRepository: jest.fn(() => managerRepository) } as any,
      ),
    ).rejects.toThrow('Forecast upsert completed but the row could not be reloaded');
  });

  it('does not replace a forecast when a newer fetch is already stored', async () => {
    const { forecastRepository, manager, queryBuilder, storedForecast } =
      createRepository([]);
    const result = await forecastRepository.upsertForecastIfNewer(
      { cityId: 'city-id', forecastDate: new Date('2026-10-12') },
      new Date('2026-10-12T10:00:00Z'),
      manager as any,
    );

    expect(queryBuilder.onConflict.mock.calls[0][0]).toContain(
      'WHERE "forecast"."fetched_at" < EXCLUDED."fetched_at"',
    );
    expect(result).toEqual({ forecast: storedForecast, updated: false });
  });

  it('reports an insert or update when the incoming fetch wins', async () => {
    const { forecastRepository, manager, storedForecast } = createRepository([
      { id: 'forecast-id' },
    ]);

    const result = await forecastRepository.upsertForecastIfNewer(
      { cityId: 'city-id', forecastDate: new Date('2026-10-12') },
      new Date('2026-10-12T10:00:00Z'),
      manager as any,
    );

    expect(result).toEqual({ forecast: storedForecast, updated: true });
  });

  it('queries recent forecasts with activity scores and the requested limit', async () => {
    const { forecastRepository, queryBuilder } = createRepository([]);
    const forecasts = [{ id: 'forecast-id' }];
    queryBuilder.getMany.mockResolvedValue(forecasts);

    await expect(forecastRepository.getRecentForecastByCity('city-id', 3)).resolves.toBe(
      forecasts,
    );

    expect(forecastRepository.createQueryBuilder).toHaveBeenCalledWith('forecast');
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
      'forecast.activityScores',
      'activityScores',
    );
    expect(queryBuilder.where).toHaveBeenCalledWith('forecast.cityId = :cityId', {
      cityId: 'city-id',
    });
    expect(queryBuilder.take).toHaveBeenCalledWith(3);
  });

  it('queries a forecast by city and ISO date, returning null when absent', async () => {
    const { forecastRepository, queryBuilder } = createRepository([]);
    const forecastDate = new Date('2026-10-12T00:00:00.000Z');
    const forecast = { id: 'forecast-id' };
    queryBuilder.getOne.mockResolvedValueOnce(forecast).mockResolvedValueOnce(null);

    await expect(
      forecastRepository.getForecastByDateAndCity('city-id', forecastDate),
    ).resolves.toBe(forecast);
    await expect(
      forecastRepository.getForecastByDateAndCity('city-id', forecastDate),
    ).resolves.toBeNull();

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'forecast.forecastDate = :forecastDate',
      { forecastDate },
    );
  });

  it('finds and deletes expired forecasts, defaulting missing affected counts to zero', async () => {
    const { forecastRepository, queryBuilder } = createRepository([]);
    const beforeDate = new Date('2026-10-12T00:00:00.000Z');
    const expired = [{ id: 'expired-forecast' }];
    queryBuilder.getMany.mockResolvedValue(expired);
    queryBuilder.execute.mockResolvedValueOnce({ raw: [], affected: 2 });
    queryBuilder.execute.mockResolvedValueOnce({ raw: [], affected: undefined });

    await expect(forecastRepository.getExpiredForecasts(beforeDate)).resolves.toBe(expired);
    await expect(forecastRepository.deleteExpiredForecasts(beforeDate)).resolves.toBe(2);
    await expect(forecastRepository.deleteExpiredForecasts(beforeDate)).resolves.toBe(0);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'forecastDate < :beforeDate',
      { beforeDate },
    );
    expect(queryBuilder.setParameters).toHaveBeenCalledWith({ beforeDate });
  });

  it('deletes forecasts by city and returns the affected row count', async () => {
    const { forecastRepository } = createRepository([]);
    const deleteForecasts = jest
      .spyOn(forecastRepository, 'delete')
      .mockResolvedValueOnce({ affected: 4 } as any)
      .mockResolvedValueOnce({ affected: undefined } as any);

    await expect(forecastRepository.deleteAllByCityId('city-id')).resolves.toBe(4);
    await expect(forecastRepository.deleteAllByCityId('city-id')).resolves.toBe(0);
    expect(deleteForecasts).toHaveBeenCalledWith({ cityId: 'city-id' });
  });

  it('returns the latest fetch time or null when there are no forecasts', async () => {
    const { forecastRepository, queryBuilder } = createRepository([]);
    const fetchedAt = new Date('2026-10-12T10:00:00.000Z');
    queryBuilder.getRawOne
      .mockResolvedValueOnce({ forecast_fetched_at: fetchedAt })
      .mockResolvedValueOnce(undefined);

    await expect(forecastRepository.getLatestFetchTimeForCity('city-id')).resolves.toBe(
      fetchedAt,
    );
    await expect(forecastRepository.getLatestFetchTimeForCity('city-id')).resolves.toBeNull();
    expect(queryBuilder.take).toHaveBeenCalledWith(1);
  });
});