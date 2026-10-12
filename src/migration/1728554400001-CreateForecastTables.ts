import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateForecastTables1728554400001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create forecast table
    await queryRunner.createTable(
      new Table({
        name: 'forecast',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'city_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'forecast_date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'fetched_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'temperature_2m_max',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'temperature_2m_min',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'temperature_2m_mean',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'precipitation_sum',
            type: 'numeric',
            precision: 8,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'precipitation_probability_max',
            type: 'numeric',
            precision: 8,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'snowfall_sum',
            type: 'numeric',
            precision: 6,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'rain_sum',
            type: 'numeric',
            precision: 8,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'wind_speed_10m_max',
            type: 'numeric',
            precision: 6,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'wind_gusts_10m_max',
            type: 'numeric',
            precision: 6,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'uv_index_max',
            type: 'numeric',
            precision: 4,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'sunshine_duration',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'condition',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['city_id'],
            referencedTableName: 'city',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['city_id', 'forecast_date'],
            isUnique: true,
            name: 'IDX_forecast_city_id_forecast_date',
          }),
          new TableIndex({
            columnNames: ['city_id', 'fetched_at'],
            name: 'IDX_forecast_city_id_fetched_at',
          }),
        ],
      }),
      true,
    );

    // Create activity_score table
    await queryRunner.createTable(
      new Table({
        name: 'activity_score',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'forecast_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'activity',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'score',
            type: 'numeric',
            precision: 3,
            scale: 1,
            isNullable: false,
          },
          {
            name: 'score_text',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'reasoning',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['forecast_id'],
            referencedTableName: 'forecast',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['forecast_id'],
            name: 'IDX_activity_score_forecast_id',
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop activity_score table first (due to foreign key dependency)
    await queryRunner.dropTable('activity_score', true);
    // Then drop forecast table
    await queryRunner.dropTable('forecast', true);
  }
}
