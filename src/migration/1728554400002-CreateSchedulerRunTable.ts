import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSchedulerRunTable1728554400002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'scheduler_run',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'job_name', type: 'varchar', length: '255' },
          { name: 'status', type: 'varchar', length: '20' },
          { name: 'started_at', type: 'timestamp' },
          { name: 'finished_at', type: 'timestamp', isNullable: true },
          { name: 'records_processed', type: 'int', default: 0 },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('scheduler_run', true);
  }
}
