import { describe, expect, it, jest } from '@jest/globals';
import { getRedisClient } from '@/config/cache/redis';
import { ForecastUpdateService } from '../../../src/scheduler/services/forecast-update.service';
import { SchedulerRunStatus } from '../../../src/scheduler/entities/scheduler-run.entity';

jest.mock('@/config/cache/redis', () => ({
  getRedisClient: jest.fn(),
}));

const asyncMock = <T>() => jest.fn<() => Promise<T>>();

describe('ForecastUpdateService', () => {
  const createService = (
    lockConnection: { connect: jest.Mock; query: jest.Mock; release: jest.Mock },
    runRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock },
  ) =>
    new ForecastUpdateService(
      { info: jest.fn(), error: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      runRepository as any,
      { createQueryRunner: jest.fn(() => lockConnection) } as any,
    );

  const createRunningService = (redisClient: unknown) => {
    const lockConnection = {
      connect: jest.fn(),
      query: asyncMock<unknown[]>()
        .mockResolvedValueOnce([{ locked: true }])
        .mockResolvedValueOnce([]),
      release: jest.fn(),
    };
    const runRepository = {
      findOne: asyncMock<unknown>().mockResolvedValue(null),
      create: jest.fn((run: Record<string, unknown>) => ({ ...run })),
      save: jest
        .fn<(run: Record<string, unknown>) => Promise<Record<string, unknown>>>()
        .mockImplementation(async (run) => run),
    };
    const weatherService = {
      weatherByCityHelper: jest
        .fn<(...args: any[]) => Promise<void>>()
        .mockResolvedValue(undefined),
    };
    const service = new ForecastUpdateService(
      { info: jest.fn(), error: jest.fn() } as any,
      weatherService as any,
      {} as any,
      {} as any,
      runRepository as any,
      { createQueryRunner: jest.fn(() => lockConnection) } as any,
    );
    jest.mocked(getRedisClient).mockReturnValue(redisClient as any);

    return { lockConnection, runRepository, service, weatherService };
  };

  it('skips a run when another process owns the scheduler lock', async () => {
    const lockConnection = {
      connect: jest.fn(),
      query: asyncMock<Array<{ locked: boolean }>>().mockResolvedValue([
        { locked: false },
      ]),
      release: jest.fn(),
    };
    const runRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = createService(lockConnection, runRepository);

    await expect(service.updateForecastsForHighFrequentCities()).resolves.toEqual(
      { citiesUpdated: 0 },
    );

    expect(runRepository.findOne).not.toHaveBeenCalled();
    expect(lockConnection.release).toHaveBeenCalled();
  });

  it('checks the cooldown and releases the lock after acquiring it', async () => {
    const lockConnection = {
      connect: jest.fn(),
      query: asyncMock<Array<{ locked: boolean }>>()
        .mockResolvedValueOnce([{ locked: true }])
        .mockResolvedValueOnce([]),
      release: jest.fn(),
    };
    const runRepository = {
      findOne: asyncMock<unknown>().mockResolvedValue({ status: 'COMPLETED' }),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = createService(lockConnection, runRepository);

    await expect(service.updateForecastsForHighFrequentCities()).resolves.toEqual(
      { citiesUpdated: 0 },
    );

    expect(runRepository.findOne).toHaveBeenCalledTimes(1);
    expect(lockConnection.query).toHaveBeenCalledTimes(2);
    expect(lockConnection.release).toHaveBeenCalled();
  });

  it('refreshes only cities above the search threshold and records completion', async () => {
    const redisClient = {
      isOpen: true,
      scanIterator: jest.fn(() =>
        (async function* () {
          yield 'city:searches:Popular';
          yield 'city:searches:Occasional';
        })(),
      ),
      get: jest
        .fn<(key: string) => Promise<string | null>>()
        .mockImplementation(async (key) =>
          key.endsWith('Popular') ? '11' : '10',
        ),
    };
    const { lockConnection, runRepository, service, weatherService } =
      createRunningService(redisClient);

    await expect(service.updateForecastsForHighFrequentCities()).resolves.toEqual({
      citiesUpdated: 1,
    });

    expect(weatherService.weatherByCityHelper).toHaveBeenCalledWith(
      'Popular',
      'SCHEDULER',
    );
    expect(weatherService.weatherByCityHelper).toHaveBeenCalledTimes(1);
    expect(runRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SchedulerRunStatus.COMPLETED,
        recordsProcessed: 1,
        lastError: null,
      }),
    );
    expect(lockConnection.query).toHaveBeenCalledTimes(2);
    expect(lockConnection.release).toHaveBeenCalled();
  });

  it('records a failed run when Redis is unavailable', async () => {
    const { lockConnection, runRepository, service } =
      createRunningService(null);

    await expect(service.updateForecastsForHighFrequentCities()).rejects.toThrow(
      'Redis is required to find frequently searched cities',
    );

    expect(runRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SchedulerRunStatus.FAILED,
        recordsProcessed: 0,
        lastError: 'Redis is required to find frequently searched cities',
      }),
    );
    expect(lockConnection.release).toHaveBeenCalled();
  });

  it('continues after an individual city fails and records the partial failure', async () => {
    const redisClient = {
      isOpen: true,
      scanIterator: jest.fn(() =>
        (async function* () {
          yield 'city:searches:Broken';
          yield 'city:searches:Healthy';
        })(),
      ),
      get: jest.fn<(key: string) => Promise<string | null>>().mockResolvedValue('12'),
    };
    const { runRepository, service, weatherService } =
      createRunningService(redisClient);
    weatherService.weatherByCityHelper
      .mockRejectedValueOnce(new Error('provider failed'))
      .mockResolvedValueOnce(undefined);

    await expect(service.updateForecastsForHighFrequentCities()).rejects.toThrow(
      'One or more city forecasts failed: Broken: provider failed',
    );

    expect(weatherService.weatherByCityHelper).toHaveBeenCalledTimes(2);
    expect(weatherService.weatherByCityHelper).toHaveBeenLastCalledWith(
      'Healthy',
      'SCHEDULER',
    );
    expect(runRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: SchedulerRunStatus.FAILED,
        recordsProcessed: 1,
        lastError: 'One or more city forecasts failed: Broken: provider failed',
      }),
    );
  });

  it('wraps a successful scheduled update in the manual response', async () => {
    const lockConnection = { connect: jest.fn(), query: jest.fn(), release: jest.fn() };
    const service = createService(lockConnection, {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    });
    jest
      .spyOn(service, 'updateForecastsForHighFrequentCities')
      .mockResolvedValue({ citiesUpdated: 3 });

    const result = await service.triggerManualUpdate();

    expect(result).toMatchObject({
      success: true,
      message: 'Forecast update completed successfully',
      citiesUpdated: 3,
    });
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});