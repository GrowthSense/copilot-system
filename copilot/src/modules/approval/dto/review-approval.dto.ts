import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewApprovalDto {
  @IsString()
  @IsNotEmpty()
  reviewedBy: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
