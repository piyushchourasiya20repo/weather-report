import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ActivityScore } from '../entities/activity-score.entity';

@Injectable()
export class ActivityScoreRepository extends Repository<ActivityScore> {
  constructor(
    private dataSource: DataSource,
  ) {
    super(ActivityScore, dataSource.createEntityManager());
  }

  async upsertActivityScore(
    score: Partial<ActivityScore>,
    manager?: EntityManager,
  ): Promise<ActivityScore> {
    const [savedScore] = await this.upsertActivityScores([score], manager);
    if (!savedScore) {
      throw new Error('Activity score upsert completed but the row could not be reloaded');
    }
    return savedScore;
  }

  async upsertActivityScores(
    scores: Partial<ActivityScore>[],
    manager?: EntityManager,
  ): Promise<ActivityScore[]> {
    if (scores.length === 0) {
      return [];
    }

    if (scores.some((score) => !score.forecastId || !score.activity)) {
      throw new Error('Activity score upsert requires forecastId and activity');
    }

    const forecastId = scores[0].forecastId!;
    if (scores.some((score) => score.forecastId !== forecastId)) {
      throw new Error('Activity score batch must belong to one forecast');
    }

    const repository = manager?.getRepository(ActivityScore) ?? this;
    const activities = [...new Set(scores.map((score) => score.activity!))];
    const uniqueScores = activities.map(
      (activity) => scores.find((score) => score.activity === activity)!,
    );

    await repository.upsert(uniqueScores, ['forecastId', 'activity']);

    return repository.find({
      where: { forecastId, activity: In(activities) },
      order: { activity: 'ASC' },
    });
  }

  async saveActivityScores(scores: Partial<ActivityScore>[]): Promise<ActivityScore[]> {
    return this.upsertActivityScores(scores);
  }

  async getScoresByForecast(forecastId: string): Promise<ActivityScore[]> {
    return this.find({
      where: { forecastId },
      order: { activity: 'ASC' },
    });
  }

  async getScoreByForecastAndActivity(
    forecastId: string,
    activity: string,
  ): Promise<ActivityScore | null> {
    const score = await this.findOne({
      where: { forecastId, activity },
    });

    return score || null;
  }
}
