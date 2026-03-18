import { Expose } from 'class-transformer';
import { KnowledgeSourceType } from '../../../common/enums/knowledge-source-type.enum';

export class ChunkResponseDto {
  @Expose() chunkId: string;
  @Expose() sourceId: string;
  @Expose() sourceTitle: string;
  @Expose() sourceType: KnowledgeSourceType;
  @Expose() sourceRef: string;
  @Expose() chunkIndex: number;
  @Expose() content: string;
  @Expose() score: number;
  @Expose() tags: string[];
}
