import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

export class IngestWebpageDto {
  /** Raw HTML content of the page. */
  @IsString()
  @IsNotEmpty()
  html: string;

  /** Canonical URL of the page — used as sourceRef and for deduplication. */
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

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
