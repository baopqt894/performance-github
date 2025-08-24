import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { RepositoryEntity } from './entities/repository.entity';
import { firstValueFrom } from 'rxjs';

type FindParams = { page: number; limit: number; q?: string; visibility?: ''|'private'|'public' };

@Injectable()
export class RepositoriesService {
  private readonly githubApi = 'https://api.github.com';
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(RepositoryEntity)
    private readonly repoRepository: Repository<RepositoryEntity>,
  ) {}

  async findPaginated({ page, limit, q = '', visibility = '' }: FindParams) {
    const where: any = {};
    if (q) where.name = ILike(`%${q}%`);
    if (visibility) where.private = visibility === 'private';

    const [data, total] = await this.repoRepository.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async syncRepositories(org: string): Promise<RepositoryEntity[]> {
    try {
      let page = 1;
      const all: any[] = [];

      while (true) {
        const url = `${this.githubApi}/orgs/${org}/repos?per_page=100&page=${page}&type=all`;
        const { data } = await firstValueFrom(
          this.httpService.get(url, {
            headers: {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          }),
        );
        if (!data?.length) break;
        all.push(...data);
        page++;
      }

      // upsert theo githubId (tránh trùng)
      await this.repoRepository.upsert(
        all.map((repo: any) => ({
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          htmlUrl: repo.html_url,
          description: repo.description,
          createdAt: new Date(repo.created_at),
          updatedAt: new Date(repo.updated_at),
        })),
        { conflictPaths: ['githubId'] },
      );

      // trả về danh sách mới nhất trong DB
      return this.repoRepository.find({ order: { updatedAt: 'DESC' } });
    } catch (error) {
      this.logger.error(error);
      throw new HttpException(
        error.response?.data || 'Failed to fetch repositories',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
