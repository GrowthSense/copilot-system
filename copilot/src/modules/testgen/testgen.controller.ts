import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TestgenService } from './testgen.service';
import { GenerateTestsDto } from './dto/generate-tests.dto';
import { created, ok } from '../../common/utils/response.util';

@Controller({ path: 'testgen', version: '1' })
export class TestgenController {
  constructor(private readonly testgenService: TestgenService) {}

  @Post()
  async generate(@Body() dto: GenerateTestsDto) {
    const result = await this.testgenService.generate(dto);
    return created(result, 'Test file generated');
  }

  @Get()
  async findByRepo(@Query('repoId') repoId: string) {
    const results = await this.testgenService.findByRepo(repoId);
    return ok(results, 'Generated tests retrieved');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.testgenService.findOne(id);
    return ok(result, 'Generated test retrieved');
  }
}
