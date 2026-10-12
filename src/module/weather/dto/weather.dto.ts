import { ObjectType, Field } from '@nestjs/graphql';

/**
 * Score for a specific activity with reasoning
 */
@ObjectType()
export class ActivityScore {
  @Field()
  activity!: string; // e.g., "Skiing", "Surfing", "Outdoor Sightseeing", "Indoor Sightseeing"

  @Field()
  score!: number; // 1-10 scale

  @Field()
  scoreText!: string; // e.g., "Excellent", "Good", "Moderate", "Poor"

  @Field(() => [String])
  reasoning!: string[]; // Array of explanations for the score
}

/**
 * Weather data and activity ratings for a single day
 */
@ObjectType()
export class DailyActivityRatings {
  @Field()
  date!: string; // ISO 8601 format

  // Raw weather metrics
  @Field()
  temperature2mMax!: number;

  @Field()
  temperature2mMin!: number;

  @Field()
  temperature2mMean!: number;

  @Field()
  precipitationSum!: number; // in mm

  @Field()
  snowfallSum!: number; // in cm

  @Field()
  rainSum!: number; // in mm

  @Field()
  windSpeed10mMax!: number; // in km/h

  @Field()
  windGusts10mMax!: number; // in km/h

  @Field()
  uvIndexMax!: number;

  @Field()
  sunshineDuration!: number; // in seconds

  @Field()
  precipitationProbabilityMax!: number; // 0-100%

  @Field()
  condition!: string;

  // Activity ratings for this day
  @Field(() => [ActivityScore])
  activityRatings!: ActivityScore[];
}

/**
 * 7-day activity suitability matrix
 */
@ObjectType()
export class ActivityMatrix {
  @Field()
  city!: string;

  @Field()
  latitude!: number;

  @Field()
  longitude!: number;

  @Field(() => [DailyActivityRatings])
  forecast!: DailyActivityRatings[];
}

/**
 * City search frequency information
 */
@ObjectType()
export class CitySearchFrequency {
  @Field()
  name!: string;

  @Field()
  searchCount!: number;

  @Field({ nullable: true })
  cityId?: number;
}

/**
 * Search statistics
 */
@ObjectType()
export class SearchStatistics {
  @Field()
  totalUniqueCities!: number;

  @Field()
  totalSearches!: number;

  @Field()
  topCitiesLimit!: number;

  @Field()
  avgSearchCount!: number;
}
