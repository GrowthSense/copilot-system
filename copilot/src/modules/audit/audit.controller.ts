import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ok } from '../../common/utils/response.util';

@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findRecent(@Query('limit') limit?: string) {
    const entries = await this.auditService.findRecent(limit ? parseInt(limit, 10) : 100);
    return ok(entries, 'Audit logs retrieved');
  }

  @Get('runs/:runId')
  async findByRun(@Param('runId') runId: string) {
    const entries = await this.auditService.findByRun(runId);
    return ok(entries, 'Audit logs for run retrieved');
  }

  @Get('entity/:entityType/:entityId')
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const entries = await this.auditService.findByEntity(entityType, entityId);
    return ok(entries, 'Audit logs for entity retrieved');
  }
}
