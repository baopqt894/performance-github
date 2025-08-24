import { Controller, Get, Query } from '@nestjs/common';
import { GitHubService } from './github.service';

@Controller('github')
export class GitHubController {
  constructor(private readonly githubService: GitHubService) {}

  // Test: Lấy repo trong org
  @Get('repos')
  async listRepos(@Query('org') org: string) {
    return this.githubService.listRepos(org);
  }

  // Test: Lấy commit trong khoảng thời gian
  @Get('commits')
  async listCommits(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('since') since: string,
    @Query('until') until: string,
  ) {
    return this.githubService.listCommits(owner, repo, since, until);
  }

  // Test: Lấy PR
  @Get('prs')
  async listPRs(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('state') state: 'open' | 'closed' | 'all' = 'all',
  ) {
    return this.githubService.listPullRequests(owner, repo, state);
  }

  // Test: Lấy Issues
  @Get('issues')
  async listIssues(
    @Query('owner') owner: string,
    @Query('repo') repo: string,
    @Query('state') state: 'open' | 'closed' | 'all' = 'all',
  ) {
    return this.githubService.listIssues(owner, repo, state);
  }

  // Test: Lấy Members của Org
  @Get('members')
  async listMembers(@Query('org') org: string) {
    return this.githubService.listMembers(org);
  }
}
