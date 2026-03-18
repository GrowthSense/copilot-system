import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrDraftStatus } from '../../../common/enums/pr-draft-status.enum';

export class UpdatePrDraftDto {
  @IsOptional()
  @IsEnum(PrDraftStatus)
  status?: PrDraftStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  prNumber?: number;

  @IsOptional()
  @IsString()
  prUrl?: string;
}
