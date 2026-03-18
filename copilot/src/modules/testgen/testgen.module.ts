import { Module } from '@nestjs/common';
import { TestgenController } from './testgen.controller';
import { TestgenService } from './testgen.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [TestgenController],
  providers: [TestgenService],
  exports: [TestgenService],
})
export class TestgenModule {}
