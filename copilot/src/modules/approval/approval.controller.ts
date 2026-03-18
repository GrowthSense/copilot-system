import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';
import { created, ok } from '../../common/utils/response.util';

@Controller({ path: 'approvals', version: '1' })
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post()
  async create(@Body() dto: CreateApprovalRequestDto) {
    const request = await this.approvalService.create(dto);
    return created(request, 'Approval request created');
  }

  @Get('pending')
  async findPending() {
    const requests = await this.approvalService.findPending();
    return ok(requests, 'Pending approval requests retrieved');
  }

  @Get('runs/:runId')
  async findByRun(@Param('runId') runId: string) {
    const requests = await this.approvalService.findByRun(runId);
    return ok(requests, 'Approval requests for run retrieved');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const request = await this.approvalService.findOne(id);
    return ok(request, 'Approval request retrieved');
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: ReviewApprovalDto) {
    const request = await this.approvalService.approve(id, dto);
    return ok(request, 'Approval request approved');
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: ReviewApprovalDto) {
    const request = await this.approvalService.reject(id, dto);
    return ok(request, 'Approval request rejected');
  }
}
