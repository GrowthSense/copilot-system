import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PrDraftService } from './prdraft.service';
import { CreatePrDraftDto } from './dto/create-pr-draft.dto';
import { UpdatePrDraftDto } from './dto/update-pr-draft.dto';
import { created, ok } from '../../common/utils/response.util';

@Controller({ path: 'pr-drafts', version: '1' })
export class PrDraftController {
  constructor(private readonly prDraftService: PrDraftService) {}

  @Post()
  async create(@Body() dto: CreatePrDraftDto) {
    const draft = await this.prDraftService.create(dto);
    return created(draft, 'PR draft created');
  }

  @Get()
  async findAll(@Query('repoFullName') repoFullName?: string) {
    const drafts = await this.prDraftService.findAll(repoFullName);
    return ok(drafts, 'PR drafts retrieved');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const draft = await this.prDraftService.findOne(id);
    return ok(draft, 'PR draft retrieved');
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePrDraftDto) {
    const draft = await this.prDraftService.update(id, dto);
    return ok(draft, 'PR draft updated');
  }

  @Patch(':id/close')
  async close(@Param('id') id: string) {
    const draft = await this.prDraftService.close(id);
    return ok(draft, 'PR draft closed');
  }
}
