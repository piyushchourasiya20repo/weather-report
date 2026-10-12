import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  ForeignKey,
  JoinColumn,
} from 'typeorm';
import { City } from './city.entity';
import { ActivityScore } from './activity-score.entity';
import { BaseEntity } from './base.entity';

@Entity('forecast')
@Index(['cityId', 'forecastDate'], { unique: true })
@Index(['cityId', 'fetchedAt'])
export class Forecast extends BaseEntity {

  @Column({ type: 'uuid', name: 'city_id' })
  cityId!: string;

  @ManyToOne(() => City, (city) => city.forecasts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'city_id' })
  city!: City;

  @Column({ type: 'date', name: 'forecast_date' })
  forecastDate!: Date;

  @CreateDateColumn({ name: 'fetched_at' })
  fetchedAt!: Date;

  // Measurements use the units returned by Open-Meteo.
  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'temperature_2m_max' })
  temperature2mMax!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'temperature_2m_min' })
  temperature2mMin!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'temperature_2m_mean' })
  temperature2mMean!: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'precipitation_sum' })
  precipitationSum!: number; // mm

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'precipitation_probability_max' })
  precipitationProbabilityMax!: number; // percent

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'snowfall_sum' })
  snowfallSum!: number; // cm

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'rain_sum' })
  rainSum!: number; // mm

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'wind_speed_10m_max' })
  windSpeed10mMax!: number; // km/h

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'wind_gusts_10m_max' })
  windGusts10mMax!: number; // km/h

  @Column({ type: 'decimal', precision: 4, scale: 2, name: 'uv_index_max' })
  uvIndexMax!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'sunshine_duration' })
  sunshineDuration!: number; // seconds

  @Column({ type: 'varchar', length: 50, name: 'condition' })
  condition!: string; // e.g., "Sunny", "Rainy", "Cloudy"

  @OneToMany(() => ActivityScore, (score) => score.forecast, {
    cascade: true,
  })
  activityScores!: ActivityScore[];
}
