import { Module } from '@nestjs/common';
import { GithubService } from './github.service';
import { GithubBranchService } from './github-branch.service';
import { GithubCommitService } from './github-commit.service';
import { GithubPrService } from './github-pr.service';

@Module({
  providers: [GithubBranchService, GithubCommitService, GithubPrService, GithubService],
  exports: [GithubService],
})
export class GithubModule {}
