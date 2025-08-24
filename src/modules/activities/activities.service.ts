// src/modules/activities/activities.service.ts (detailed, per-dev breakdown)
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Activity, ActivityType } from './entities/activity.entity';
import { Member } from '../members/entities/member.entity';
import { RepositoryEntity } from '../repositories/entities/repository.entity';

/**
 * NOTE – mở rộng ActivityType để báo cáo chi tiết:
 *  - 'commit'
 *  - 'pull_request' (PR mở)
 *  - 'pr_merged'    (PR merge trong khoảng)
 *  - 'issue'
 *  - 'review' (tổng – fallback)
 *  - 'review_approved' | 'review_changes_requested' | 'review_commented'
 *
 * Cần cập nhật entity Activity.type (Enum hoặc varchar) để chấp nhận các giá trị mới nếu bạn muốn phân tách review.
 */

// yyyy-mm-dd (inclusive)
export type DateRange = { since: string; until: string };

interface RepoReport {
  fullName: string;
  repositoryId: number;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  reviewsTotal: number;
  reviewsApproved: number;
  reviewsChanges: number;
  reviewsCommented: number;
  issues: number;
  additions: number;
  deletions: number;
  skipped?: string; // lý do bỏ qua (409/404/archived/permission)
  errors?: string[]; // các lỗi non-fatal
}

interface MemberTopRepo {
  repo: string;
  total: number;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  reviews: number;
  issues: number;
}

interface MemberBreakdownRow {
  login: string;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  issues: number;
  reviewsTotal: number;
  reviewsApproved: number;
  reviewsChanges: number;
  reviewsCommented: number;
  additions: number;
  deletions: number;
  activeDays: number;
  reposTouched: number;
  topRepos: MemberTopRepo[];
  score: number;
}

interface SyncReport {
  range: DateRange;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  perRepo: RepoReport[];
  perMember: MemberBreakdownRow[];
  totals: {
    commits: number;
    prsOpened: number;
    prsMerged: number;
    reviewsTotal: number;
    issues: number;
    additions: number;
    deletions: number;
    processedRepos: number;
    skippedRepos: number;
  };
}

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);
  private readonly api = 'https://api.github.com';

  constructor(
    private readonly http: HttpService,
    @InjectRepository(Activity) private readonly actRepo: Repository<Activity>,
    @InjectRepository(Member) private readonly memberRepo: Repository<Member>,
    @InjectRepository(RepositoryEntity) private readonly repoRepo: Repository<RepositoryEntity>,
  ) {}

  /* ------------------ Helpers ------------------ */
  private ghHeaders() {
    return {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nest-github-performance',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  private toDateOnlyUTC(iso: string): string {
    const d = new Date(iso);
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return utc.toISOString().slice(0, 10);
  }

  /** Lấy danh sách members tồn tại trong DB (login -> id) */
  private async buildMemberMap(): Promise<Map<string, number>> {
    const members = await this.memberRepo.find();
    const map = new Map<string, number>();
    for (const m of members) map.set(m.login.toLowerCase(), m.id);
    return map;
  }

  /** Lấy danh sách repo (fullName -> id) */
  private async buildRepoMap(): Promise<Map<string, number>> {
    const repos = await this.repoRepo.find();
    const map = new Map<string, number>();
    for (const r of repos) map.set(r.fullName.toLowerCase(), r.id);
    return map;
  }

  /* ------------------ Robust fetch with retry & rate-limit handling ------------------ */
  private async fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
    let attempt = 0;
    let lastErr: any = null;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        const res = await firstValueFrom(this.http.get(url, { headers: this.ghHeaders() }));
        return res;
      } catch (err: any) {
        lastErr = err;
        const status = err?.response?.status;

        // RATE LIMIT -> try to respect X-RateLimit-Reset
        if (status === 403) {
          const reset = err.response?.headers?.['x-ratelimit-reset'];
          if (reset) {
            const resetTs = Number(reset) * 1000;
            const wait = Math.max(resetTs - Date.now() + 1000, 1000);
            this.logger.warn(`Rate limited. Waiting ${Math.round(wait / 1000)}s before retrying ${url}`);
            await this.sleep(wait);
            continue; // retry after sleep
          }
        }

        // Conflict or not-found: bubble up (để skip repo)
        if (status === 409 || status === 404) throw err;

        // Backoff on transient errors
        const backoff = Math.min(1000 * Math.pow(2, attempt), 30_000);
        this.logger.warn(`Fetch attempt ${attempt} failed for ${url}: ${err?.message}. Backoff ${backoff}ms`);
        await this.sleep(backoff);
      }
    }
    throw lastErr;
  }

  /** Phân trang chung */
  private async paginate<T>(url: string): Promise<T[]> {
    let page = 1;
    const all: T[] = [];
    while (true) {
      const u = `${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`;
      const { data } = await this.fetchWithRetry(u);
      if (!data || data.length === 0) break;
      all.push(...(data as T[]));
      page++;
    }
    return all;
  }

  /* ------------------ BUCKETS & Upsert ------------------ */
  private bumpBucket(
    buckets: Map<string, Activity>,
    p: { memberId: number; repositoryId: number; type: ActivityType; date: string; inc: number; add?: number; del?: number },
  ) {
    const key = `${p.memberId}|${p.repositoryId}|${p.type}|${p.date}`;
    let a = buckets.get(key);
    if (!a) {
      a = this.actRepo.create({
        memberId: p.memberId,
        repositoryId: p.repositoryId,
        type: p.type,
        activityDate: p.date,
        count: 0,
        additions: 0,
        deletions: 0,
      });
      buckets.set(key, a);
    }
    a.count += p.inc;
    a.additions += p.add ?? 0;
    a.deletions += p.del ?? 0;
  }

  private async flushBuckets(buckets: Map<string, Activity>) {
    if (buckets.size === 0) return;
    const values = Array.from(buckets.values()).map((v) => ({
      memberId: v.memberId,
      repositoryId: v.repositoryId,
      type: v.type,
      activityDate: v.activityDate,
      count: v.count,
      additions: v.additions,
      deletions: v.deletions,
    }));

    await this.actRepo
      .createQueryBuilder()
      .insert()
      .into(Activity)
      .values(values)
      .orUpdate(
        ['count', 'additions', 'deletions'],
        ['memberId', 'repositoryId', 'type', 'activityDate'],
      )
      .execute();
  }

  /* ------------------ COLLECTORS ------------------ */
  private async collectCommits(
    fullName: string,
    repositoryId: number,
    range: DateRange,
    memberMap: Map<string, number>,
    buckets: Map<string, Activity>,
    repoReport: RepoReport,
    options: { fetchCommitStats?: boolean; commitStatsConcurrency?: number } = {},
  ) {
    const url = `${this.api}/repos/${fullName}/commits?since=${range.since}T00:00:00Z&until=${range.until}T23:59:59Z`;
    let commits: any[] = [];
    try {
      commits = await this.paginate<any>(url);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        repoReport.skipped = '409 Conflict (empty/archived repo)';
        this.logger.warn(`Skip commits for ${fullName} due 409`);
        return;
      }
      if (status === 404) {
        repoReport.skipped = '404 Not Found';
        this.logger.warn(`Skip commits for ${fullName} due 404`);
        return;
      }
      throw err;
    }

    repoReport.commits += commits.length;

    if (options.fetchCommitStats && commits.length > 0) {
      const concurrency = options.commitStatsConcurrency ?? 5;
      let idx = 0;
      const workers: Promise<void>[] = [];
      const next = async () => {
        while (true) {
          const i = idx++;
          if (i >= commits.length) return;
          const c = commits[i];
          try {
            const sha = c.sha;
            const { data } = await this.fetchWithRetry(`${this.api}/repos/${fullName}/commits/${sha}`);
            if (data?.stats) {
              repoReport.additions += Number(data.stats.additions || 0);
              repoReport.deletions += Number(data.stats.deletions || 0);
            }
          } catch (err: any) {
            this.logger.warn(`Failed fetch commit ${c.sha} stats: ${err?.message}`);
            repoReport.errors?.push?.(`commit-stats:${c.sha}:${err?.message}`);
          }
        }
      };
      for (let w = 0; w < concurrency; w++) workers.push(next());
      await Promise.all(workers);
    }

    for (const c of commits) {
      const login = c.author?.login?.toLowerCase();
      const memberId = login ? memberMap.get(login) : undefined;
      if (!memberId) continue;
      const date = this.toDateOnlyUTC(c.commit?.author?.date || c.commit?.committer?.date || new Date().toISOString());
      this.bumpBucket(buckets, { memberId, repositoryId, type: 'commit' as ActivityType, date, inc: 1, add: 0, del: 0 });
    }
  }

  private async collectPRsAndReviews(
    fullName: string,
    repositoryId: number,
    range: DateRange,
    memberMap: Map<string, number>,
    buckets: Map<string, Activity>,
    repoReport: RepoReport,
  ) {
    let page = 1;
    outer: while (true) {
      const u = `${this.api}/repos/${fullName}/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`;
      let pulls: any[] = [];
      try {
        const resp = await this.fetchWithRetry(u);
        pulls = resp.data || [];
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 409) {
          repoReport.skipped = (repoReport.skipped ? repoReport.skipped + '; ' : '') + '409 (pulls)';
          this.logger.warn(`Skip PRs for ${fullName} due 409`);
          return;
        }
        if (status === 404) {
          repoReport.skipped = (repoReport.skipped ? repoReport.skipped + '; ' : '') + '404 (pulls)';
          this.logger.warn(`Skip PRs for ${fullName} due 404`);
          return;
        }
        throw err;
      }
      if (!pulls || pulls.length === 0) break;

      for (const pr of pulls) {
        const created = pr.created_at?.slice(0, 10);
        if (!created) continue;
        if (created < range.since) break outer; // vì sort desc
        if (created > range.until) continue; // mới hơn until

        // Author mở PR
        const login = pr.user?.login?.toLowerCase();
        const memberId = login ? memberMap.get(login) : undefined;
        if (memberId) {
          this.bumpBucket(buckets, { memberId, repositoryId, type: 'pull_request' as ActivityType, date: created, inc: 1 });
          repoReport.prsOpened += 1;
        }

        // Reviews của PR trong khoảng submitted_at
        try {
          const reviews = await this.paginate<any>(`${this.api}/repos/${fullName}/pulls/${pr.number}/reviews`);
          for (const rv of reviews) {
            const submitted = rv.submitted_at?.slice(0, 10);
            if (!submitted || submitted < range.since || submitted > range.until) continue;
            const rlogin = rv.user?.login?.toLowerCase();
            const rMemberId = rlogin ? memberMap.get(rlogin) : undefined;
            if (!rMemberId) continue;

            // Tổng review
            this.bumpBucket(buckets, { memberId: rMemberId, repositoryId, type: 'review' as ActivityType, date: submitted, inc: 1 });
            repoReport.reviewsTotal += 1;

            // Theo state
            const state: string = (rv.state || '').toUpperCase();
            if (state === 'APPROVED') {
              this.bumpBucket(buckets, { memberId: rMemberId, repositoryId, type: 'review_approved' as ActivityType, date: submitted, inc: 1 });
              repoReport.reviewsApproved += 1;
            } else if (state === 'CHANGES_REQUESTED') {
              this.bumpBucket(buckets, { memberId: rMemberId, repositoryId, type: 'review_changes_requested' as ActivityType, date: submitted, inc: 1 });
              repoReport.reviewsChanges += 1;
            } else if (state === 'COMMENTED') {
              this.bumpBucket(buckets, { memberId: rMemberId, repositoryId, type: 'review_commented' as ActivityType, date: submitted, inc: 1 });
              repoReport.reviewsCommented += 1;
            }
          }
        } catch (err: any) {
          this.logger.warn(`Failed to fetch reviews for ${fullName} PR#${pr.number}: ${err?.message}`);
          repoReport.errors?.push?.(`reviews-pr${pr.number}:${err?.message}`);
        }
      }
      page++;
    }
  }

  /** PR MERGED trong khoảng ngày – dùng Search API để không bỏ sót PR tạo trước đó nhưng merge trong range */
  private async collectMergedPRs(
    fullName: string,
    repositoryId: number,
    range: DateRange,
    memberMap: Map<string, number>,
    buckets: Map<string, Activity>,
    repoReport: RepoReport,
  ) {
    let page = 1;
    while (true) {
      const q = encodeURIComponent(`repo:${fullName} is:pr is:merged merged:${range.since}..${range.until}`);
      const u = `${this.api}/search/issues?q=${q}&per_page=100&page=${page}`;
      const resp = await this.fetchWithRetry(u);
      const items = resp.data?.items || [];
      if (!items.length) break;

      for (const it of items) {
        const login = it.user?.login?.toLowerCase();
        const memberId = login ? memberMap.get(login) : undefined; // author của PR
        const mergedDate = (it.closed_at || it.updated_at || it.created_at)?.slice(0, 10); // close ~ merge time
        if (!memberId || !mergedDate) continue;
        this.bumpBucket(buckets, { memberId, repositoryId, type: 'pr_merged' as ActivityType, date: mergedDate, inc: 1 });
        repoReport.prsMerged += 1;
      }

      if (items.length < 100) break;
      page++;
    }
  }

  /** Issues mở trong khoảng ngày */
  private async collectIssues(
    fullName: string,
    repositoryId: number,
    range: DateRange,
    memberMap: Map<string, number>,
    buckets: Map<string, Activity>,
    repoReport: RepoReport,
  ) {
    let page = 1;
    while (true) {
      const q = encodeURIComponent(`repo:${fullName} type:issue created:${range.since}..${range.until}`);
      const u = `${this.api}/search/issues?q=${q}&per_page=100&page=${page}`;
      const resp = await this.fetchWithRetry(u);
      const items = resp.data?.items || [];
      if (items.length === 0) break;

      for (const is of items) {
        const login = is.user?.login?.toLowerCase();
        const memberId = login ? memberMap.get(login) : undefined;
        const created = is.created_at?.slice(0, 10);
        if (memberId && created) {
          this.bumpBucket(buckets, { memberId, repositoryId, type: 'issue' as ActivityType, date: created, inc: 1 });
          repoReport.issues += 1;
        }
      }

      if (items.length < 100) break;
      page++;
    }
  }

  /* ------------------ PUBLIC API: syncRange với báo cáo per-dev ------------------ */
  /**
   * options:
   *  - onlyReposFullName?: string[]  // filter repo list
   *  - concurrency?: number          // số repo xử lý song song (mặc định 1)
   *  - fetchCommitStats?: boolean    // lấy additions/deletions per commit (tốn quota)
   *  - commitStatsConcurrency?: number
   *  - printMemberBreakdown?: boolean // in breakdown theo dev (mặc định true)
   */
  async syncRange(
    range: DateRange,
    onlyReposFullName?: string[],
    options: { concurrency?: number; fetchCommitStats?: boolean; commitStatsConcurrency?: number; printMemberBreakdown?: boolean } = {},
  ): Promise<SyncReport> {
    const startedAt = new Date().toISOString();
    const memberMap = await this.buildMemberMap();

    // Lấy repo list; filter nếu truyền onlyReposFullName
    let repos = await this.repoRepo.find();
    if (onlyReposFullName?.length) {
      const set = new Set(onlyReposFullName.map((s) => s.toLowerCase()));
      repos = repos.filter((r) => set.has(r.fullName.toLowerCase()));
    }

    const buckets = new Map<string, Activity>();
    const perRepo: RepoReport[] = [];

    const concurrency = options.concurrency && options.concurrency > 0 ? options.concurrency : 1;
    const queue = repos.slice();

    const runOne = async (repo: RepositoryEntity) => {
      const repoReport: RepoReport = {
        fullName: repo.fullName,
        repositoryId: repo.id,
        commits: 0,
        prsOpened: 0,
        prsMerged: 0,
        reviewsTotal: 0,
        reviewsApproved: 0,
        reviewsChanges: 0,
        reviewsCommented: 0,
        issues: 0,
        additions: 0,
        deletions: 0,
        errors: [],
      };

      this.logger.log(`Start sync repo ${repo.fullName}`);
      try {
        await this.collectCommits(repo.fullName, repo.id, range, memberMap, buckets, repoReport, {
          fetchCommitStats: options.fetchCommitStats,
          commitStatsConcurrency: options.commitStatsConcurrency,
        });
        await this.collectPRsAndReviews(repo.fullName, repo.id, range, memberMap, buckets, repoReport);
        await this.collectMergedPRs(repo.fullName, repo.id, range, memberMap, buckets, repoReport);
        await this.collectIssues(repo.fullName, repo.id, range, memberMap, buckets, repoReport);
      } catch (err: any) {
        this.logger.error(`Repo ${repo.fullName} failed: ${err?.message}`);
        repoReport.errors?.push?.(err?.message || String(err));
      }

      perRepo.push(repoReport);
      this.logger.log(`Finished repo ${repo.fullName} -> commits=${repoReport.commits} prsOpened=${repoReport.prsOpened} prsMerged=${repoReport.prsMerged} reviews=${repoReport.reviewsTotal} issues=${repoReport.issues}`);
    };

    // worker pool
    const workers: Promise<void>[] = [];
    for (let w = 0; w < concurrency; w++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const r = queue.shift();
            if (!r) break;
            await runOne(r);
          }
        })(),
      );
    }
    await Promise.all(workers);

    // Persist
    await this.flushBuckets(buckets);

    // Build per-member breakdown từ bảng Activity
    const perMember = await this.aggregatePerMemberDetailed(range, 5);

    // Totals
    const totals = perRepo.reduce(
      (acc, r) => {
        if (r.skipped) acc.skippedRepos++; else acc.processedRepos++;
        acc.commits += r.commits;
        acc.prsOpened += r.prsOpened;
        acc.prsMerged += r.prsMerged;
        acc.reviewsTotal += r.reviewsTotal;
        acc.issues += r.issues;
        acc.additions += r.additions;
        acc.deletions += r.deletions;
        return acc;
      },
      { commits: 0, prsOpened: 0, prsMerged: 0, reviewsTotal: 0, issues: 0, additions: 0, deletions: 0, processedRepos: 0, skippedRepos: 0 },
    );

    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

    const report: SyncReport = {
      range,
      startedAt,
      finishedAt,
      durationMs,
      perRepo,
      perMember,
      totals,
    };

    this.printReport(report, options.printMemberBreakdown !== false);
    return report;
  }

  /* ------------------ Aggregations: per-dev chi tiết ------------------ */
  /** Trả về breakdown chi tiết theo dev trong khoảng ngày + top repos (mặc định top 5) */
  async aggregatePerMemberDetailed(range: DateRange, topN = 5): Promise<MemberBreakdownRow[]> {
    // Tổng hợp theo dev
    const rows = await this.actRepo
      .createQueryBuilder('a')
      .leftJoin(Member, 'm', 'm.id = a.memberId')
      .select('m.login', 'login')
      .addSelect(`SUM(CASE WHEN a.type = 'commit' THEN a.count ELSE 0 END)`, 'commits')
      .addSelect(`SUM(CASE WHEN a.type = 'pull_request' THEN a.count ELSE 0 END)`, 'prsOpened')
      .addSelect(`SUM(CASE WHEN a.type = 'pr_merged' THEN a.count ELSE 0 END)`, 'prsMerged')
      .addSelect(`SUM(CASE WHEN a.type = 'issue' THEN a.count ELSE 0 END)`, 'issues')
      .addSelect(`SUM(CASE WHEN a.type IN ('review','review_approved','review_changes_requested','review_commented') THEN a.count ELSE 0 END)`, 'reviewsTotal')
      .addSelect(`SUM(CASE WHEN a.type = 'review_approved' THEN a.count ELSE 0 END)`, 'reviewsApproved')
      .addSelect(`SUM(CASE WHEN a.type = 'review_changes_requested' THEN a.count ELSE 0 END)`, 'reviewsChanges')
      .addSelect(`SUM(CASE WHEN a.type = 'review_commented' THEN a.count ELSE 0 END)`, 'reviewsCommented')
      .addSelect('SUM(a.additions)', 'additions')
      .addSelect('SUM(a.deletions)', 'deletions')
      .where('a.activityDate BETWEEN :since AND :until', range)
      .groupBy('m.login')
      .orderBy('m.login', 'ASC')
      .getRawMany();

    // Active days per member
    const activeDayRows = await this.actRepo
      .createQueryBuilder('a')
      .select('a.memberId', 'mid')
      .addSelect('COUNT(DISTINCT a.activityDate)', 'activeDays')
      .where('a.activityDate BETWEEN :since AND :until', range)
      .groupBy('a.memberId')
      .getRawMany();
    const activeDayMap = new Map<number, number>();
    // map login->id to reuse
    const memberLoginToId = new Map<string, number>();
    const members = await this.memberRepo.find();
    for (const m of members) memberLoginToId.set(m.login, m.id);
    for (const r of activeDayRows) activeDayMap.set(Number(r.mid), Number(r.activeDays));

    // Repos touched per member
    const reposTouchedRows = await this.actRepo
      .createQueryBuilder('a')
      .select('a.memberId', 'mid')
      .addSelect('COUNT(DISTINCT a.repositoryId)', 'reposTouched')
      .where('a.activityDate BETWEEN :since AND :until', range)
      .groupBy('a.memberId')
      .getRawMany();
    const reposTouchedMap = new Map<number, number>();
    for (const r of reposTouchedRows) reposTouchedMap.set(Number(r.mid), Number(r.reposTouched));

    // Top repos per member
    const topRows = await this.actRepo
      .createQueryBuilder('a')
      .leftJoin(RepositoryEntity, 'r', 'r.id = a.repositoryId')
      .select('a.memberId', 'mid')
      .addSelect('r.fullName', 'repo')
      .addSelect('SUM(a.count)', 'total')
      .addSelect(`SUM(CASE WHEN a.type = 'commit' THEN a.count ELSE 0 END)`, 'commits')
      .addSelect(`SUM(CASE WHEN a.type = 'pull_request' THEN a.count ELSE 0 END)`, 'prsOpened')
      .addSelect(`SUM(CASE WHEN a.type = 'pr_merged' THEN a.count ELSE 0 END)`, 'prsMerged')
      .addSelect(`SUM(CASE WHEN a.type IN ('review','review_approved','review_changes_requested','review_commented') THEN a.count ELSE 0 END)`, 'reviews')
      .addSelect(`SUM(CASE WHEN a.type = 'issue' THEN a.count ELSE 0 END)`, 'issues')
      .where('a.activityDate BETWEEN :since AND :until', range)
      .groupBy('a.memberId, r.fullName')
      .orderBy('total', 'DESC')
      .getRawMany();

    const topMap = new Map<number, MemberTopRepo[]>();
    for (const tr of topRows) {
      const mid = Number(tr.mid);
      if (!topMap.has(mid)) topMap.set(mid, []);
      topMap.get(mid)!.push({
        repo: tr.repo,
        total: Number(tr.total || 0),
        commits: Number(tr.commits || 0),
        prsOpened: Number(tr.prsOpened || 0),
        prsMerged: Number(tr.prsMerged || 0),
        reviews: Number(tr.reviews || 0),
        issues: Number(tr.issues || 0),
      });
    }

    const result: MemberBreakdownRow[] = [];
    for (const r of rows) {
      const login = r.login;
      const mid = memberLoginToId.get(login) || 0;
      const commits = Number(r.commits || 0);
      const prsOpened = Number(r.prsOpened || 0);
      const prsMerged = Number(r.prsMerged || 0);
      const issues = Number(r.issues || 0);
      const reviewsTotal = Number(r.reviewsTotal || 0);
      const reviewsApproved = Number(r.reviewsApproved || 0);
      const reviewsChanges = Number(r.reviewsChanges || 0);
      const reviewsCommented = Number(r.reviewsCommented || 0);
      const additions = Number(r.additions || 0);
      const deletions = Number(r.deletions || 0);
      const activeDays = activeDayMap.get(mid) || 0;
      const reposTouched = reposTouchedMap.get(mid) || 0;
      const topRepos = (topMap.get(mid) || []).sort((a, b) => b.total - a.total).slice(0, topN);

      // Công thức điểm (tuỳ chỉnh):
      const score = commits * 1 + prsOpened * 3 + prsMerged * 4 + reviewsApproved * 3 + reviewsChanges * 2.5 + reviewsCommented * 1.5 + issues * 1 + Math.min(additions / 40, 10);

      result.push({
        login,
        commits,
        prsOpened,
        prsMerged,
        issues,
        reviewsTotal,
        reviewsApproved,
        reviewsChanges,
        reviewsCommented,
        additions,
        deletions,
        activeDays,
        reposTouched,
        topRepos,
        score: Math.round(score * 100) / 100,
      });
    }

    return result;
  }

  /* ------------------ Pretty print report ------------------ */
  private printReport(report: SyncReport, printMember = true) {
    this.logger.log('===== Sync Report =====');
    this.logger.log(`Range: ${report.range.since} .. ${report.range.until}`);
    this.logger.log(`Started: ${report.startedAt}`);
    this.logger.log(`Finished: ${report.finishedAt} (duration ${report.durationMs}ms)`);
    this.logger.log(`Repos processed: ${report.totals.processedRepos}, skipped: ${report.totals.skippedRepos}`);
    this.logger.log(`Totals -> commits:${report.totals.commits} prsOpened:${report.totals.prsOpened} prsMerged:${report.totals.prsMerged} reviews:${report.totals.reviewsTotal} issues:${report.totals.issues} additions:${report.totals.additions} deletions:${report.totals.deletions}`);

    this.logger.log('--- Per Repo ---');
    for (const r of report.perRepo) {
      const line = `${r.fullName} -> commits:${r.commits} prsOpened:${r.prsOpened} prsMerged:${r.prsMerged} reviews:${r.reviewsTotal} (A:${r.reviewsApproved}/C:${r.reviewsChanges}/Cm:${r.reviewsCommented}) issues:${r.issues} additions:${r.additions} deletions:${r.deletions}` + (r.skipped ? ` SKIPPED: ${r.skipped}` : '');
      this.logger.log(line);
      if (r.errors && r.errors.length) this.logger.warn(`  errors: ${r.errors.join(' | ')}`);
    }

    if (!printMember) return;
    this.logger.log('--- Per Member ---');
    for (const m of report.perMember) {
      this.logger.log(
        `${m.login} -> commits:${m.commits} prsOpened:${m.prsOpened} prsMerged:${m.prsMerged} reviews:${m.reviewsTotal} (A:${m.reviewsApproved}/C:${m.reviewsChanges}/Cm:${m.reviewsCommented}) issues:${m.issues} additions:${m.additions} deletions:${m.deletions} activeDays:${m.activeDays} reposTouched:${m.reposTouched} score:${m.score}`,
      );
      if (m.topRepos?.length) {
        for (const tr of m.topRepos) {
          this.logger.log(`   • ${tr.repo} -> total:${tr.total} commits:${tr.commits} prsOpened:${tr.prsOpened} prsMerged:${tr.prsMerged} reviews:${tr.reviews} issues:${tr.issues}`);
        }
      }
    }
  }
}
