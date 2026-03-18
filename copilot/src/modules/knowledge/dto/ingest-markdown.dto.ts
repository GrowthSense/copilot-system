import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class IngestMarkdownDto {
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
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
