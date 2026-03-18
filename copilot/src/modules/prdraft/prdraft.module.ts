import { Module } from '@nestjs/common';
import { PrDraftController } from './prdraft.controller';
import { PrDraftService } from './prdraft.service';

@Module({
  controllers: [PrDraftController],
  providers: [PrDraftService],
  exports: [PrDraftService],
})
export class PrDraftModule {}
