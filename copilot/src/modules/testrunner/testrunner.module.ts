import { Module } from '@nestjs/common';
import { TestrunnerService } from './testrunner.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [TestrunnerService],
  exports: [TestrunnerService],
})
export class TestrunnerModule {}
