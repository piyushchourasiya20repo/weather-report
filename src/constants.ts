export const APP_CONSTANTS = {
  NAME: 'weather-report',
  DEFAULT_PORT: 3000,
  DEFAULT_LOG_LEVEL: 'info',
  GRAPHQL_PATH: '/graphql',
  REQUEST_ID_HEADER: 'x-request-id',
  REQUEST_ID_PATTERN: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/,
  REDACTED_VALUE: '[Redacted]',
} as const;

export const REDIS_DEFAULTS = {
  MAX_RETRIES: 10,
  RETRY_DELAY_MS: 50,
  MAX_RETRY_DELAY_MS: 2000,
  CONNECT_TIMEOUT_MS: 10000,
  KEEP_ALIVE_MS: 30000,
} as const;

export const TIME_CONSTANTS = {
  SECONDS_PER_HOUR: 60 * 60,
  MILLISECONDS_PER_HOUR: 60 * 60 * 1000,
} as const;

export const CACHE_CONSTANTS = {
  DEFAULT_TTL_SECONDS: TIME_CONSTANTS.SECONDS_PER_HOUR,
  COUNTER_TTL_SECONDS: TIME_CONSTANTS.SECONDS_PER_HOUR * 6,
} as const;

export const OPEN_METEO_CONSTANTS = {
  GEOCODING_RESULT_COUNT: 1,
  LANGUAGE: 'en',
  RESPONSE_FORMAT: 'json',
  DEFAULT_FORECAST_DAYS: 7,
  TIMEZONE: 'auto',
  DAILY_FIELDS: [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'apparent_temperature_max',
    'sunrise',
    'sunset',
    'daylight_duration',
    'sunshine_duration',
    'uv_index_max',
    'rain_sum',
    'showers_sum',
    'snowfall_sum',
    'precipitation_sum',
    'precipitation_hours',
    'precipitation_probability_max',
    'wind_speed_10m_max',
    'wind_gusts_10m_max',
    'wind_direction_10m_dominant',
  ].join(','),
} as const;

export const SCHEDULER_CONSTANTS = {
  JOB_NAME: 'forecast-update',
  SEARCH_COUNT_THRESHOLD: 10,
  MIN_INTERVAL_MS: TIME_CONSTANTS.MILLISECONDS_PER_HOUR * 6 - 60 * 1000,
  REDIS_SEARCH_KEY_PREFIX: 'city:searches:',
  REDIS_SCAN_COUNT: 100,
} as const;