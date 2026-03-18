import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { DatabaseService } from './modules/database/database.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseService,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.dbPing()]);
  }

  private async dbPing(): Promise<HealthIndicatorResult> {
    await this.db.$queryRaw`SELECT 1`;
    return { database: { status: 'up' } };
  }
}
