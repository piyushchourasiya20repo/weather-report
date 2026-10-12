import { Injectable } from '@nestjs/common';
import { APP_CONSTANTS } from './constants';

@Injectable()
export class AppService {
  getHello(): string {
    return `Welcome to Weather Report API! Visit ${APP_CONSTANTS.GRAPHQL_PATH} to explore the GraphQL API.`;
  }
}
