import { describe, expect, it, jest } from '@jest/globals';
import { CityRepository } from '../../../../src/module/weather/repositories/city.repository';

const asyncMock = <T>() => jest.fn<() => Promise<T>>();

describe('CityRepository', () => {
  it('returns the city inserted by a concurrent request after a unique conflict', async () => {
    const city = { id: 'city-id', name: 'Example' };
    const repository = {
      create: jest.fn((value) => value),
      findOne: asyncMock<typeof city | null>().mockResolvedValue(city),
      save: asyncMock<unknown>().mockRejectedValue({
        driverError: { code: '23505' },
      }),
    };
    const cityRepository = new CityRepository(repository as any);

    await expect(
      cityRepository.save('Example', 1, 2),
    ).resolves.toBe(city);

    expect(repository.findOne).toHaveBeenCalledTimes(1);
  });

  it('rethrows save errors unrelated to a unique conflict', async () => {
    const databaseError = { driverError: { code: '08006' } };
    const repository = {
      create: jest.fn((value) => value),
      findOne: jest.fn(),
      save: asyncMock<unknown>().mockRejectedValue(databaseError),
    };
    const cityRepository = new CityRepository(repository as any);

    await expect(cityRepository.save('Example', 1, 2)).rejects.toBe(databaseError);

    expect(repository.findOne).not.toHaveBeenCalled();
  });
});