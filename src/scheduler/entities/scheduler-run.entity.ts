import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../module/weather/entities/base.entity';

export enum SchedulerRunStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('scheduler_run')
export class SchedulerRun extends BaseEntity {
  @Column({ name: 'job_name', type: 'varchar', length: 255 })
  jobName!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: SchedulerRunStatus;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'records_processed', type: 'int', default: 0 })
  recordsProcessed!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}
