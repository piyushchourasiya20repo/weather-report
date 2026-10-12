import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddActivityScoreUniqueConstraint1728554400003
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_scores AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY forecast_id, activity
            ORDER BY updated_at DESC, created_at DESC, id DESC
          ) AS row_number
        FROM activity_score
      )
      DELETE FROM activity_score AS score
      USING ranked_scores
      WHERE score.id = ranked_scores.id
        AND ranked_scores.row_number > 1
    `);

    await queryRunner.createIndex(
      'activity_score',
      new TableIndex({
        name: 'IDX_activity_score_forecast_activity',
        columnNames: ['forecast_id', 'activity'],
        isUnique: true,
      }),
    );
    await queryRunner.dropIndex(
      'activity_score',
      'IDX_activity_score_forecast_id',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'activity_score',
      'IDX_activity_score_forecast_activity',
    );
    await queryRunner.createIndex(
      'activity_score',
      new TableIndex({
        name: 'IDX_activity_score_forecast_id',
        columnNames: ['forecast_id'],
      }),
    );
  }
}