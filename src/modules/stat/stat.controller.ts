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
}
