import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { IngestionService } from './ingestion.service';
import { ChunkingService } from './chunking.service';
import { RetrievalService } from './retrieval.service';
import { EMBEDDING_PROVIDER_TOKEN } from './embedding/embedding-provider.token';
import { StubEmbeddingProvider } from './embedding/stub-embedding.provider';

@Module({
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    IngestionService,
    ChunkingService,
    RetrievalService,
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useClass: StubEmbeddingProvider,
    },
  ],
  exports: [KnowledgeService, RetrievalService],
})
export class KnowledgeModule {}
