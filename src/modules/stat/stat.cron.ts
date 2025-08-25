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
        log(`---\nBắt đầu xử lý repo: ${r.name}, owner: ${owner}`);
        try {

          // Lấy dữ liệu từ ngày hôm qua đến hôm nay
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const since = yesterday.toISOString(); // Ngày bắt đầu lấy dữ liệu
          const until = today.toISOString();     // Ngày kết thúc là hiện tại
          // Lấy commit ở tất cả các nhánh
          let commits: any[] = [];
          try {
            commits = await this.statService.getAllBranchCommits(owner, r.name, since, until);
            log(`Lấy commit thành công cho repo ${r.name} (owner: ${owner}, tất cả branch), số lượng: ${commits.length}`);
          } catch (err) {
            log(`Lỗi lấy commit cho repo ${r.name} (owner: ${owner}): ${err?.message || err}`);
          }
          try {
            const result = await this.statService.saveCommits(commits, r.name, owner);
            log(`Đã lưu ${Array.isArray(result) ? result.length : 0} commit cho repo ${r.name} (owner: ${owner})`);
          } catch (err) {
            log(`Lỗi lưu commit cho repo ${r.name} (owner: ${owner}): ${err?.message || err}`);
          }

          let prs: any[] = [];
          try {
            const prsRaw = await this.githubUtils.getPullRequests(owner, r.name, 'all');
            prs = (prsRaw as any[]).filter(pr => {
              const created = new Date(pr.created_at);
              return created >= new Date(since) && created <= today;
            });
            log(`Lấy pull request thành công cho repo ${r.name} (owner: ${owner}), số lượng: ${prs.length}`);
          } catch (err) {
            log(`Lỗi lấy pull request cho repo ${r.name} (owner: ${owner}): ${err?.message || err}`);
          }
          try {
            log(`Đang lưu pull request của repo ${r.name} (owner: ${owner})`);
            const prResult = await this.statService.savePullRequests(prs, r.name, owner);
            log(`Đã lưu ${Array.isArray(prResult) ? prResult.length : 0} pull request cho repo ${r.name} (owner: ${owner})`);
          } catch (err) {
            log(`Lỗi lưu pull request cho repo ${r.name} (owner: ${owner}): ${err?.message || err}`);
          }

          // Lấy và lưu review assign cho từng pull request
          for (const pr of prs as any[]) {
            try {
              const reviewResult = await this.statService.savePullRequestReviewsAssign(pr, r.name, owner, pr.id || pr.number);
              log(`Đã lưu ${Array.isArray(reviewResult) ? reviewResult.length : 0} assigned review cho PR ${pr.id || pr.number} của repo ${r.name} (owner: ${owner})`);
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err: any) {
              log(`Lỗi lưu assigned review cho PR ${pr.id || pr.number} của repo ${r.name} (owner: ${owner}): ${err?.message || err}`);
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
