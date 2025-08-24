import { Controller, Get, Query, Render } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';

@Controller('repos')
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Get()
  @Render('repos')
  async page(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('q') q = '',
    @Query('visibility') visibility = '',
    @Query('org') org = process.env.GITHUB_ORG || '',
  ) {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const { data, total } = await this.repositoriesService.findPaginated({
      page: p,
      limit: l,
      q,
    });

    const lastPage = Math.max(Math.ceil(total / l), 1);
    const prevPage = Math.max(p - 1, 1);
    const nextPage = Math.min(p + 1, lastPage);

    // định dạng ngày cho UI
    const items = data.map((r) => ({
      ...r,
      updatedAt: new Date(r.updatedAt).toLocaleString(),
    }));

    return {
      title: 'Repositories',
      items,
      total,
      page: p,
      lastPage,
      prevPage,
      nextPage,
      isFirst: p <= 1,
      isLast: p >= lastPage,
      q,
      visibility,
      org,
    };
  }

  @Get('sync')
  async sync(@Query('org') org: string) {
    const result = await this.repositoriesService.syncRepositories(org);
    return { synced: result.length };
  }
}
