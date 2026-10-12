import { DataSourceOptions } from 'typeorm';
import { env } from '../env';
import { City } from '../../module/weather/entities/city.entity';
import { Forecast } from '../../module/weather/entities/forecast.entity';
import { ActivityScore } from '../../module/weather/entities/activity-score.entity';
import { SchedulerRun } from '../../scheduler/entities/scheduler-run.entity';

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT, 10),
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [City, Forecast, ActivityScore, SchedulerRun],
  migrations: ['dist/migration/*.js'],
  synchronize: false, // Schema changes are applied through migrations.
  logging: false,
};
