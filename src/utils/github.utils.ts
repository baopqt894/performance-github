import axios, { AxiosInstance } from "axios";

export class GitHubUtils {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
  }

  /* ========== Helper để handle pagination ========== */
  private async fetchAll<T>(
    url: string,
    params: Record<string, any> = {}
  ): Promise<T[]> {
    let page = 1;
    let results: T[] = [];

    while (true) {
      const res = await this.client.get<T[]>(url, {
        params: { ...params, per_page: 100, page },
      });
    
      results = results.concat(res.data);
      console.log(`results:`,results);
      if (res.data.length < 100) break; // hết dữ liệu
      page++;
      // Thêm delay 500ms giữa các lần gọi API để tránh bị rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /* ================= REPOSITORY ================= */

  async getOrgRepos(org: string) {
    return this.fetchAll(`/orgs/${org}/repos`, { type: "all" });
  }

  async getRepo(owner: string, repo: string) {
    const res = await this.client.get(`/repos/${owner}/${repo}`);
    return res.data;
  }

  /* ================= COMMITS ================= */

  async getCommits(owner: string, repo: string, since: string, until: string) {
    return this.fetchAll(`/repos/${owner}/${repo}/commits`, { since, until });
  }

  async getCommitDetail(owner: string, repo: string, sha: string) {
    const res = await this.client.get(`/repos/${owner}/${repo}/commits/${sha}`);
    return res.data;
  }

  /* ================= PULL REQUEST ================= */

  async getPullRequests(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "all"
  ) {
    return this.fetchAll(`/repos/${owner}/${repo}/pulls`, { state });
  }

  async getPullRequestDetail(owner: string, repo: string, pull_number: number) {
    const res = await this.client.get(
      `/repos/${owner}/${repo}/pulls/${pull_number}`
    );
    return res.data;
  }

  async getPullRequestCommits(owner: string, repo: string, pull_number: number) {
    return this.fetchAll(`/repos/${owner}/${repo}/pulls/${pull_number}/commits`);
  }

  async getPullRequestFiles(owner: string, repo: string, pull_number: number) {
    return this.fetchAll(`/repos/${owner}/${repo}/pulls/${pull_number}/files`);
  }

  /* ================= REVIEWS & COMMENTS ================= */

  async getPullRequestReviews(owner: string, repo: string, pull_number: number) {
    return this.fetchAll(
      `/repos/${owner}/${repo}/pulls/${pull_number}/reviews`
    );
  }

  async getPullRequestComments(
    owner: string,
    repo: string,
    pull_number: number
  ) {
    return this.fetchAll(`/repos/${owner}/${repo}/pulls/${pull_number}/comments`);
  }

  /* ================= ISSUES ================= */

  async getIssues(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "all"
  ) {
    return this.fetchAll(`/repos/${owner}/${repo}/issues`, { state });
  }

  async getIssueComments(owner: string, repo: string, issue_number: number) {
    return this.fetchAll(
      `/repos/${owner}/${repo}/issues/${issue_number}/comments`
    );
  }

  /* ================= MEMBERS ================= */

  async getOrgMembers(org: string) {
    return this.fetchAll(`/orgs/${org}/members`);
  }

  async getUser(username: string) {
    const res = await this.client.get(`/users/${username}`);
    return res.data;
  }
}
