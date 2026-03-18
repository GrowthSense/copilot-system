import { Expose } from 'class-transformer';
import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';

export class SourceResponseDto {
  @Expose() id: string;
  @Expose() title: string;
  @Expose() sourceType: KnowledgeSourceType;
  @Expose() sourceRef: string;
  @Expose() checksum: string;
  @Expose() tags: string[];
  @Expose() wordCount: number;
  @Expose() isActive: boolean;
  @Expose() chunkCount: number;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
