import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Forecast } from './forecast.entity';
import { BaseEntity } from './base.entity';

@Entity('activity_score')
@Index(['forecastId', 'activity'], { unique: true })
export class ActivityScore extends BaseEntity {

  @Column({ type: 'uuid', name: 'forecast_id' })
  forecastId!: string;

  @ManyToOne(() => Forecast, (forecast) => forecast.activityScores, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'forecast_id' })
  forecast!: Forecast;

  @Column({ type: 'varchar', length: 100, name: 'activity' })
  activity!: string; // e.g., "Skiing", "Surfing", "Outdoor Sightseeing"

  @Column({ type: 'decimal', precision: 3, scale: 1, name: 'score' })
  score!: number; // 1-10 scale

  @Column({ type: 'varchar', length: 50, name: 'score_text' })
  scoreText!: string; // e.g., "Excellent", "Good", "Moderate", "Poor"

  @Column({ type: 'json', name: 'reasoning' })
  reasoning!: string[]; // Array of explanations for the score
}
