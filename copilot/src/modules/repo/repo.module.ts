import { Module } from '@nestjs/common';
import { RepoController } from './repo.controller';
import { RepoService } from './repo.service';
import { RepoIndexService } from './repo-index.service';
import { RepoSearchService } from './repo-search.service';
import { RepoMapService } from './repo-map.service';
import { FileReaderService } from './file-reader.service';

@Module({
  controllers: [RepoController],
  providers: [
    RepoService,
    RepoIndexService,
    RepoSearchService,
    RepoMapService,
    FileReaderService,
  ],
  exports: [
    RepoService,
    RepoIndexService,
    RepoSearchService,
    RepoMapService,
    FileReaderService,
  ],
})
export class RepoModule {}
