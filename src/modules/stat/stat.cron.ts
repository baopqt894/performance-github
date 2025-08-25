import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StatService } from './stat.service';
import { OrganizationService } from '../organization/organization.service';
import { MembersService } from '../members/members.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { GitHubUtils } from '../../utils/github.utils';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StatCron {
  private readonly logger = new Logger(StatCron.name);

  constructor(
    private readonly statService: StatService,
    private readonly organizationService: OrganizationService,
    private readonly membersService: MembersService,
    private readonly repositoriesService: RepositoriesService,
    private readonly githubUtils: GitHubUtils,
  ) { }

  // Chạy mỗi ngày lúc 9h sáng
  @Cron('0 9 * * *')
  async handleStatCommits() {
    const logPath = path.join(__dirname, '../../stat-cron.log');
    const log = (msg: string) => {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
      this.logger.log(msg);
    };
    try {
      const org = 'FoxCodeStudio';
      const members = await this.organizationService.getOrganizationMembers(org);
      log(`Tìm thấy ${members.length} thành viên trong tổ chức ${org}`);
      const orgRepos = await this.githubUtils.getOrgRepos(org);
      log(`Tổ chức ${org} có ${orgRepos.length} repo`);
      for (const r of orgRepos as any[]) {
        const owner = r.owner?.login || org;
        try {

          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const since = yesterday.toISOString().slice(0, 10);
          const until = today.toISOString().slice(0, 10); 
          // Lấy commit ở tất cả các nhánh
          const commits = await this.statService.getAllBranchCommits(owner, r.name, since, until);
          log(`Lấy commit thành công cho repo ${r.name} (tất cả branch), số lượng: ${commits.length}`);
          const result = await this.statService.saveCommits(commits, r.name, owner);
          log(`Đã lưu ${Array.isArray(result) ? result.length : 0} commit cho repo ${r.name}`);

          const prsRaw = await this.githubUtils.getPullRequests(owner, r.name, 'all');
          const prs = (prsRaw as any[]).filter(pr => {
            const created = new Date(pr.created_at);
            return created >= new Date(since) && created <= today;
          });
          log(`Lấy pull request thành công cho repo ${r.name}, số lượng: ${prs.length}`);
          log(`Đang lưu pull request của repo ${r.name}`);
          const prResult = await this.statService.savePullRequests(prs, r.name, owner);
          log(`Đã lưu ${Array.isArray(prResult) ? prResult.length : 0} pull request cho repo ${r.name}`);

          // Lấy và lưu review cho từng pull request
          for (const pr of prs as any[]) {
            try {
              const reviews = await this.githubUtils.getPullRequestReviews(owner, r.name, pr.id || pr.number);
              log(`Lấy review thành công cho PR ${pr.id || pr.number} của repo ${r.name}, số lượng: ${reviews.length}`);
              const reviewResult = await this.statService.savePullRequestReviews(reviews, r.name, owner, pr.id || pr.number);
              log(`Đã lưu ${Array.isArray(reviewResult) ? reviewResult.length : 0} review cho PR ${pr.id || pr.number} của repo ${r.name}`);
              // Thêm delay giữa các lần gọi API để tránh rate limit
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err: any) {
              if (err?.response?.status) {
                log(`Lấy review thất bại cho PR ${pr.id || pr.number} của repo ${r.name} - status: ${err.response.status}`);
              } else {
                log(`Lấy review thất bại cho PR ${pr.id || pr.number} của repo ${r.name} - lỗi: ${err}`);
              }
              continue;
            }
          }
        } catch (err: any) {
          if (err?.response?.status) {
            log(`Lấy dữ liệu thất bại cho repo ${r.name} - status: ${err.response.status}`);
          } else {
            log(`Lấy dữ liệu thất bại cho repo ${r.name} - lỗi: ${err}`);
          }
          continue;
        }
      }
      log('Stat cronjob completed!');
    } catch (error) {
      log(`Stat cronjob failed: ${error}`);
    }
  }
}
