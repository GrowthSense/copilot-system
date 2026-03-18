import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PatchService } from './patch.service';
import { CreatePatchDto } from './dto/create-patch.dto';
import { created, ok } from '../../common/utils/response.util';

@Controller({ path: 'patches', version: '1' })
export class PatchController {
  constructor(private readonly patchService: PatchService) {}

  @Post()
  async create(@Body() dto: CreatePatchDto) {
    const patch = await this.patchService.create(dto);
    return created(patch, 'Patch proposal created');
  }

  @Get()
  async findAll(@Query('repoId') repoId?: string) {
    const patches = await this.patchService.findAll(repoId);
    return ok(patches, 'Patch proposals retrieved');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const patch = await this.patchService.findOne(id);
    return ok(patch, 'Patch proposal retrieved');
  }

  @Patch(':id/apply')
  async markApplied(@Param('id') id: string, @Query('prUrl') prUrl?: string) {
    const patch = await this.patchService.markApplied(id, prUrl);
    return ok(patch, 'Patch proposal marked as applied');
  }
}
