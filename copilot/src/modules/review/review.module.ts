import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
