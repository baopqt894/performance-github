import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CommitEntity } from './entities/stat.entity';
import { PullRequestEntity, PullRequestReviewEntity } from './entities/pull.entity';
import { GitHubUtils } from '../../utils/github.utils';

@Injectable()
export class StatService {
  constructor(
    @InjectRepository(CommitEntity)
    private readonly commitRepo: Repository<CommitEntity>,
    @InjectRepository(PullRequestEntity)
    private readonly prRepo: Repository<PullRequestEntity>,
    @InjectRepository(PullRequestReviewEntity)
    private readonly prReviewRepo: Repository<PullRequestReviewEntity>,
    private readonly githubUtils: GitHubUtils,
  ) {}

  async saveCommits(commits: any[], repo: string, owner: string) {
    // Xoá commit trùng nhau theo sha
    const uniqueCommits = Array.from(new Map(commits.map(c => [c.sha, c])).values());
    const entities = uniqueCommits.map(commit => ({
      sha: commit.sha,
      repo,
      owner,
      author_name: commit.commit.author.name,
      author_email: commit.commit.author.email,
      date: commit.commit.author.date,
      message: commit.commit.message,
      parents: commit.parents,
      commit_raw: commit,
    }));
    return this.commitRepo.save(entities);
  }

  async savePullRequests(prs: any[], repo: string, owner: string) {
    // Xoá trùng theo pr_id
    const uniquePRs = Array.from(new Map(prs.map(p => [p.id, p])).values());
    const entities = uniquePRs.map(pr => ({
      pr_id: String(pr.id),
      repo,
      owner,
      pr_raw: pr,
    }));
    return this.prRepo.save(entities);
  }

  async savePullRequestReviews(reviews: any[], pr_id: number, repo: string, owner: string) {
    // Xoá trùng theo review_id
    const uniqueReviews = Array.from(new Map(reviews.map(r => [r.id, r])).values());
    const entities = uniqueReviews.map(review => ({
      review_id: String(review.id),
      pr_id: String(pr_id),
      repo,
      owner,
      review_raw: review,
    }));
    return this.prReviewRepo.save(entities);
  }

  async getCommitsByUser(username: string) {
    return this.commitRepo.find({ where: { author_name: username } });
  }

  async getAllCommits() {
    return this.commitRepo.find();
  }

  async getPullRequests(owner?: string, repo?: string) {
    const where: any = {};
    if (owner) where.owner = owner;
    if (repo) where.repo = repo;
    return this.prRepo.find({ where });
  }

  async getPullRequestReviews(owner?: string, repo?: string, pr_id?: number) {
    const where: any = {};
    if (owner) where.owner = owner;
    if (repo) where.repo = repo;
    if (pr_id) where.pr_id = pr_id;
    return this.prReviewRepo.find({ where });
  }

  async getPullRequestsByAuthor(author: string) {
    const prs = await this.prRepo.createQueryBuilder('pr')
      .where(`pr.pr_raw->'user'->>'login' = :author`, { author })
      .getMany();

    console.log('Tổng số PR:', prs.length);
    const result: any[] = [];
    for (const pr of prs) {
      console.log('Đang xử lý PR:', pr.pr_id, pr.owner, pr.repo);
      let additions = pr.pr_raw?.additions || 0;
      try {
        console.log('Gọi API diff cho PR:', pr.pr_id);
        const diff = await this.githubUtils.getPullRequestDiff(pr.owner, pr.repo, pr.pr_id);
        console.log('Diff:', diff);
        const lines = diff.split('\n');
        let added = 0;
        for (const line of lines) {
          if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
          if (line.startsWith('+') && !line.startsWith('+++') && line.trim() !== '+') added++;
        }
        additions = added;
        console.log('PR:', pr.pr_id, 'Additions:', additions);
      } catch (e) {
        console.log('PR:', pr.pr_id, 'Lỗi lấy diff:', e);
        // fallback to pr_raw.additions nếu lỗi
      }
      result.push({
        ...pr,
        additions
      });
    }
    return result;
  }

  async getPullRequestReviewsByAuthor(author: string) {
    return this.prReviewRepo.createQueryBuilder('review')
      .where(`review.review_raw->'user'->>'login' = :author`, { author })
      .getMany();
  }

  async getPullRequestDiff(owner: string, repo: string, pull_number: string | number) {
    return this.githubUtils.getPullRequestDiff(owner, repo, pull_number);
  }

  async getMemberPerformance(from?: string, to?: string): Promise<any[]> {
    // Lấy danh sách tất cả member
    const members = await this.githubUtils.getOrgMembers('FoxCodeStudio');
    // Xử lý khoảng thời gian
    let fromDate: string | undefined;
    let toDate: string | undefined;
    if (from) fromDate = new Date(from).toISOString();
    if (to) toDate = new Date(to).toISOString();
    const result: any[] = [];
    for (const member of members as any[]) {
      const username = member.login;
      const avatar = member.avatar_url;
      // Đếm số commit trong khoảng thời gian
      const commitWhere: any = { author_name: username };
      if (fromDate && toDate) commitWhere.date = Between(fromDate, toDate);
      const commitCount = await this.commitRepo.count({ where: commitWhere });
      // Đếm số pull request trong khoảng thời gian
      let prCount = 0;
      if (fromDate && toDate) {
        prCount = await this.prRepo.createQueryBuilder('pr')
          .where(`pr.pr_raw->'user'->>'login' = :username`, { username })
          .andWhere(`pr.pr_raw->>'created_at' >= :fromDate AND pr.pr_raw->>'created_at' <= :toDate`, { fromDate, toDate })
          .getCount();
      } else {
        prCount = await this.prRepo.createQueryBuilder('pr')
          .where(`pr.pr_raw->'user'->>'login' = :username`, { username })
          .getCount();
      }
      // Đếm số review trong khoảng thời gian
      let reviewCount = 0;
      if (fromDate && toDate) {
        reviewCount = await this.prReviewRepo.createQueryBuilder('review')
          .where(`review.review_raw->'user'->>'login' = :username`, { username })
          .andWhere(`review.review_raw->>'submitted_at' >= :fromDate AND review.review_raw->>'submitted_at' <= :toDate`, { fromDate, toDate })
          .getCount();
      } else {
        reviewCount = await this.prReviewRepo.createQueryBuilder('review')
          .where(`review.review_raw->'user'->>'login' = :username`, { username })
          .getCount();
      }
      // Tính chỉ số performance (có thể tuỳ chỉnh công thức)
      const performance = commitCount + prCount * 2 + reviewCount;
      result.push({
        username,
        avatar,
        performance,
        commitCount,
        prCount,
        reviewCount
      });
    }
    // Sắp xếp theo performance giảm dần
    result.sort((a, b) => b.performance - a.performance);
    return result;
  }

  async getAllBranchCommits(owner: string, repo: string, since: string, until: string): Promise<any[]> {
    // Lấy danh sách branch
    const branches = await this.githubUtils.fetchAll(`/repos/${owner}/${repo}/branches`);
    let allCommits: any[] = [];
    for (const branch of branches as any[]) {
      const branchName = branch.name;
      // Lấy commit của từng branch
      const commits = await this.githubUtils.fetchAll(`/repos/${owner}/${repo}/commits`, { sha: branchName, since, until });
      allCommits = allCommits.concat(commits);
      // Thêm delay tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    // Loại trùng theo sha
    const uniqueCommits = Array.from(new Map(allCommits.map(c => [c.sha, c])).values());
    return uniqueCommits;
  }

  async getMemberActivities(username: string, from?: string, to?: string): Promise<any> {
    // Mặc định lấy từ 1 tháng trước đến nay
    const today = to ? new Date(to) : new Date();
    const lastMonth = from ? new Date(from) : new Date(today);
    if (!from) lastMonth.setMonth(today.getMonth() - 1);
    const fromDate = lastMonth.toISOString();
    const toDate = today.toISOString();

    // Commit
    const commits = await this.commitRepo.find({
      where: {
        author_name: username,
        date: Between(fromDate, toDate)
      }
    });

    // Pull Request
    const prs = await this.prRepo.createQueryBuilder('pr')
      .where(`pr.pr_raw->'user'->>'login' = :username`, { username })
      .andWhere(`pr.pr_raw->>'created_at' >= :fromDate AND pr.pr_raw->>'created_at' <= :toDate`, { fromDate, toDate })
      .getMany();
    // Chỉ trả về các trường cần thiết cho PR
    const prDetails = prs.map(pr => ({
      pr_id: pr.pr_id,
      repo: pr.repo,
      owner: pr.owner,
      pr_raw: {
        url: pr.pr_raw?.url,
        html_url: pr.pr_raw?.html_url,
        title: pr.pr_raw?.title,
        state: pr.pr_raw?.state,
        created_at: pr.pr_raw?.created_at,
        updated_at: pr.pr_raw?.updated_at,
        closed_at: pr.pr_raw?.closed_at,
        merged_at: pr.pr_raw?.merged_at,
      }
    }));

    return {
      username,
      from: fromDate,
      to: toDate,
      commits,
      pull_requests: prDetails
    };
  }

}
