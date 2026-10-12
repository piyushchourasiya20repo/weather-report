import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Forecast } from './forecast.entity';
import { BaseEntity } from './base.entity';

@Entity('city')
@Index(['name'], { unique: true })
export class City extends BaseEntity {

  @Column({ type: 'varchar', length: 255, unique: true, name: 'name' })
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, name: 'latitude' })
  latitude!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, name: 'longitude' })
  longitude!: number;

  @OneToMany(() => Forecast, (forecast) => forecast.city, {
    cascade: true,
  })
  forecasts!: Forecast[];
}
