import { StatCron } from './stat.cron';

import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { StatService } from './stat.service';

@Controller('stat')
export class StatController {
  constructor(
    private readonly statService: StatService,
    private readonly statCron: StatCron,
  ) {}
  @Post('sync')
  async syncCommits() {
    await this.statCron.handleStatCommits();
    return { message: 'Sync started' };
  }

  @Get('commits')
  async getCommits(@Query('username') username: string) {
    if (username) {
      return this.statService.getCommitsByUser(username);
    }
    return this.statService.getAllCommits();
  }

  @Post('commits')
  async saveCommits(@Body() body: { commits: any[], repo: string, owner: string }) {
    return this.statService.saveCommits(body.commits, body.repo, body.owner);
  }

  @Get('pull-requests')
  async getPullRequests(@Query('owner') owner: string, @Query('repo') repo: string) {
    return this.statService.getPullRequests(owner, repo);
  }

  @Get('pull-request-reviews')
  async getPullRequestReviews(@Query('owner') owner: string, @Query('repo') repo: string, @Query('pr_id') pr_id: number) {
    return this.statService.getPullRequestReviews(owner, repo, pr_id);
  }

  @Get('pull-requests-by-author')
  async getPullRequestsByAuthor(@Query('author') author: string) {
    const result = await this.statService.getPullRequestsByAuthor(author);
    return result;
  }

  @Get('pull-request-reviews-by-author')
  async getPullRequestReviewsByAuthor(@Query('author') author: string) {
    return this.statService.getPullRequestReviewsByAuthor(author);
  }

  @Get('member-performance')
  async getMemberPerformanceList(
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    // Hỗ trợ nhập ngày dạng dd/MM/yyyy
    function parseDate(dateStr?: string): string | undefined {
      if (!dateStr) return undefined;
      const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [_, day, month, year] = match;
        return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
      }
      return dateStr;
    }
    const fromParsed = parseDate(from);
    const toParsed = parseDate(to);
    return await this.statService.getMemberPerformance(fromParsed, toParsed);
  }

  @Get('member-activities')
  async getMemberActivities(
    @Query('username') username: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    // Hỗ trợ nhập ngày dạng dd/MM/yyyy
    function parseDate(dateStr?: string): string | undefined {
      if (!dateStr) return undefined;
      // Nếu đúng định dạng dd/MM/yyyy thì chuyển sang ISO
      const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [_, day, month, year] = match;
        return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
      }
      // Nếu không thì trả về nguyên bản (có thể là ISO hoặc yyyy-MM-dd)
      return dateStr;
    }
    const fromParsed = parseDate(from);
    const toParsed = parseDate(to);
    return await this.statService.getMemberActivities(username, fromParsed, toParsed);
  }
}
