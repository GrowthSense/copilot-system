import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class IngestDocumentDto {
  @IsString()
  @IsNotEmpty()
  repoId: string;

  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
