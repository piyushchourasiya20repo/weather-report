# Weather Report API

A NestJS GraphQL API that retrieves seven-day forecasts from Open-Meteo and scores each day for outdoor and indoor activities. City coordinates and forecast data are persisted in PostgreSQL; Redis tracks city search counts for scheduled refreshes.

## Features

- City geocoding and daily forecast data from the Open-Meteo APIs
- Seven-day weather forecasts with activity suitability scores and explanations
- PostgreSQL persistence with migrations and forecast freshness checks
- Optional Redis search counters and a six-hour forecast update job
- GraphQL Playground for interactive queries

## Requirements

- Node.js and npm
- PostgreSQL
- Redis (optional; required for search-count-based scheduled updates)
- Network access to the Open-Meteo geocoding and forecast APIs

## Setup

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env` to configure the application locally. The application loads `.env` automatically; values set in the process environment take precedence.

Create a PostgreSQL database named `weather_report`, or set `DB_NAME` to an existing database. Database defaults are `localhost:5432`, user `postgres`, and password `postgres`. Override them with these environment variables:

| Variable | Default |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | `postgres` |
| `DB_NAME` | `weather_report` |
| `PORT` | `3000` |
| `LOG_LEVEL` | `info` |

Redis defaults to `127.0.0.1:6379`. Redis settings:

| Variable | Default |
| --- | --- |
| `REDIS_HOST` | `localhost` |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | Empty |
| `REDIS_DB` | `0` |
| `REDIS_TLS` | `false` |

Open-Meteo endpoints can be overridden with `OPEN_METEO_GEOCODING_API_URL` and `OPEN_METEO_FORECAST_API_URL`. Their defaults are the public Open-Meteo geocoding and forecast endpoints.

The application initializes the database and runs pending migrations at startup. Redis connection failure is logged, but the API continues without Redis caching.

## Run

Development with watch mode:

```bash
npm run start:dev
```

Build and run in production mode:

```bash
npm run build
npm run start:prod
```

The server listens on port `3000` by default. Open `http://localhost:3000/graphql` for GraphQL Playground. Logs are structured JSON; set `LOG_LEVEL` to change the minimum level.

## GraphQL API

The `getWeather` query accepts a city name and returns coordinates plus up to seven days of forecast data and activity ratings:

```graphql
query {
  getWeather(city: "New York") {
    city
    latitude
    longitude
    forecast {
      date
      condition
      temperature2mMax
      temperature2mMin
      precipitationSum
      precipitationProbabilityMax
      windSpeed10mMax
      uvIndexMax
      activityRatings {
        activity
        score
        scoreText
        reasoning
      }
    }
  }
}
```

`getWeather` returns `null` if the city cannot be located. Provider and database failures are logged and returned as GraphQL errors. Forecasts are stored in PostgreSQL and reused while fresh. Weather measurements use the units returned by Open-Meteo (including temperatures in Celsius and wind speed in km/h).

## Request Tracing

Send a valid `X-Request-Id` header to correlate a request with its logs. If the header is missing or invalid, the API generates a UUID. The selected ID is returned in the `X-Request-Id` response header and appears as `traceId` in request and request-scoped service logs.

## REST Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Welcome response |
| `POST` | `/test/update-forecasts` | Manually trigger the forecast update job |

The scheduled job runs every six hours and refreshes forecasts for cities whose Redis search count is above 10. The manual endpoint returns the number of updated cities and a timestamp on success; failures are logged and returned as HTTP errors.

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm run start:debug` | Start in debug/watch mode |
| `npm run build` | Compile the application |
| `npm run start:prod` | Run the compiled application |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run migration:generate` | Generate a TypeORM migration |
| `npm run migration:run` | Apply TypeORM migrations |
| `npm run migration:revert` | Revert the last TypeORM migration |

## License

UNLICENSED

