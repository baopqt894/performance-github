import { Injectable } from '@nestjs/common';
import { GitHubUtils } from 'src/utils/github.utils';


@Injectable()
export class GitHubService {
  private utils: GitHubUtils;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Missing GITHUB_TOKEN in env');
    this.utils = new GitHubUtils(token);
  }

  // Repo
  async listRepos(org: string) {
    return this.utils.getOrgRepos(org);
  }

  async getRepo(owner: string, repo: string) {
    return this.utils.getRepo(owner, repo);
  }

  // Commit
  async listCommits(owner: string, repo: string, since: string, until: string) {
    return this.utils.getCommits(owner, repo, since, until);
  }

  async getCommitDetail(owner: string, repo: string, sha: string) {
    return this.utils.getCommitDetail(owner, repo, sha);
  }

  // Pull Requests
  async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all') {
    return this.utils.getPullRequests(owner, repo, state);
  }

  async getPullRequestDetail(owner: string, repo: string, number: number) {
    return this.utils.getPullRequestDetail(owner, repo, number);
  }

  async getPullRequestCommits(owner: string, repo: string, number: number) {
    return this.utils.getPullRequestCommits(owner, repo, number);
  }

  // Issues
  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all') {
    return this.utils.getIssues(owner, repo, state);
  }

  async getIssueComments(owner: string, repo: string, issueNumber: number) {
    return this.utils.getIssueComments(owner, repo, issueNumber);
  }

  // Members
  async listMembers(org: string) {
    return this.utils.getOrgMembers(org);
  }

  async getUser(username: string) {
    return this.utils.getUser(username);
  }
}
