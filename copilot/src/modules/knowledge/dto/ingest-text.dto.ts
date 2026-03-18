import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';

export class IngestTextDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  sourceRef: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(KnowledgeSourceType)
  sourceType?: KnowledgeSourceType = KnowledgeSourceType.PLAIN_TEXT;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
