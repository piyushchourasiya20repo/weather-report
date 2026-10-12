import 'dotenv/config';

export const env: NodeJS.ProcessEnv & {
	DB_HOST: string;
	DB_PORT: string;
	DB_USERNAME: string;
	DB_PASSWORD: string;
	DB_NAME: string;
	REDIS_HOST: string;
	REDIS_PORT: string;
	REDIS_PASSWORD: string;
	REDIS_DB: string;
	REDIS_TLS: string;
	OPEN_METEO_GEOCODING_API_URL: string;
	OPEN_METEO_FORECAST_API_URL: string;
} = {
	...process.env,
	DB_HOST: process.env.DB_HOST ?? 'localhost',
	DB_PORT: process.env.DB_PORT ?? '5432',
	DB_USERNAME: process.env.DB_USERNAME ?? 'postgres',
	DB_PASSWORD: process.env.DB_PASSWORD ?? 'postgres',
	DB_NAME: process.env.DB_NAME ?? 'weather_report',
	REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
	REDIS_PORT: process.env.REDIS_PORT ?? '6379',
	REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? '',
	REDIS_DB: process.env.REDIS_DB ?? '0',
	REDIS_TLS: process.env.REDIS_TLS ?? 'false',
	OPEN_METEO_GEOCODING_API_URL:
		process.env.OPEN_METEO_GEOCODING_API_URL ??
		'https://geocoding-api.open-meteo.com/v1/search',
	OPEN_METEO_FORECAST_API_URL:
		process.env.OPEN_METEO_FORECAST_API_URL ??
		'https://api.open-meteo.com/v1/forecast',
};