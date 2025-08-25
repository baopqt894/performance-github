import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatController } from './stat.controller';
import { StatService } from './stat.service';
import { CommitEntity } from './entities/stat.entity';
import { StatCron } from './stat.cron';
import { OrganizationModule } from '../organization/organization.module';
import { MembersModule } from '../members/members.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { GitHubUtils } from '../../utils/github.utils';
import { PullRequestEntity, PullRequestReviewEntity } from './entities/pull.entity';
import { PerformanceController } from '../../controllers/performance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CommitEntity, PullRequestEntity, PullRequestReviewEntity]), OrganizationModule, MembersModule, RepositoriesModule],
  controllers: [StatController, PerformanceController],
  providers: [StatService, StatCron, {
    provide: GitHubUtils,
    useFactory: () => new GitHubUtils(process.env.GITHUB_TOKEN || ''),
  }],
})
export class StatModule {}
