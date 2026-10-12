import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WeatherModule } from './module/weather/weather.module';
import { IntegrationModule } from './integration/integration.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { databaseConfig } from './config';
import { createRequestId } from './config/logger';
import { env } from './config/env';
import { APP_CONSTANTS } from './constants';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL ?? APP_CONSTANTS.DEFAULT_LOG_LEVEL,
        genReqId: createRequestId,
        customAttributeKeys: { reqId: 'traceId' },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          censor: APP_CONSTANTS.REDACTED_VALUE,
        },
      },
    }),
    TypeOrmModule.forRoot(databaseConfig),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'src/schema.gql',
      sortSchema: true,
      playground: true,
    }),
    IntegrationModule,
    WeatherModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
