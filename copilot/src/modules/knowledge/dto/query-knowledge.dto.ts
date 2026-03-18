import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';

export class QueryKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsString()
  repoId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;

  @IsOptional()
  @IsEnum(KnowledgeSourceType)
  sourceType?: KnowledgeSourceType;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((t: string) => t.trim()) : value,
  )
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((t: string) => t.trim()) : value,
  )
  @IsArray()
  @IsString({ each: true })
  sourceIds?: string[];
}
