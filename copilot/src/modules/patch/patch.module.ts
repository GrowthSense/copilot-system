import { Module } from '@nestjs/common';
import { PatchController } from './patch.controller';
import { PatchService } from './patch.service';
import { PatchValidatorService } from './patch-validator.service';

@Module({
  controllers: [PatchController],
  providers: [PatchService, PatchValidatorService],
  exports: [PatchService, PatchValidatorService],
})
export class PatchModule {}
