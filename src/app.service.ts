import { Injectable } from '@nestjs/common';
import { APP_CONSTANTS } from './constants';

@Injectable()
export class AppService {
  healthCheck(): string {
    return `health check ok`;
  }
}
