import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StatService } from './stat.service';
import { OrganizationService } from '../organization/organization.service';
import { MembersService } from '../members/members.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { GitHubUtils } from '../../utils/github.utils';

@Injectable()
export class StatCron {
  private readonly logger = new Logger(StatCron.name);

  constructor(
    private readonly statService: StatService,
    private readonly organizationService: OrganizationService,
    private readonly membersService: MembersService,
    private readonly repositoriesService: RepositoriesService,
    private readonly githubUtils: GitHubUtils,
  ) {}

  // Chạy mỗi ngày lúc 9h sáng
  @Cron('0 9 * * *')
  async handleStatCommits() {
    try {
      const org = 'FoxCodeStudio';
      // Lấy danh sách thành viên qua service
      const members = await this.organizationService.getOrganizationMembers(org);
      for (const member of members) {
        // Lấy danh sách repo của từng member bằng GitHubUtils và repos_url
        const repos = await this.githubUtils.fetchAll(member.repos_url);
        for (const repo of repos) {
          // Lấy tất cả commit của repo qua instance githubUtils đã inject
          const commits = await this.githubUtils.getCommits(member.login, repo.name, '', '');
          // Lưu vào database
          await this.statService.saveCommits(commits, repo.name, member.login);
        }
      }
      this.logger.log('Stat cronjob completed!');
    } catch (error) {
      this.logger.error('Stat cronjob failed', error);
    }
  }
}
