import { Controller, Get, Render, Query } from '@nestjs/common';
import { StatService } from '../modules/stat/stat.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly statService: StatService) {}

  @Get()
  @Render('performance')
  async showPerformance(@Query('since') since?: string, @Query('until') until?: string) {
    // Hỗ trợ nhập ngày dạng dd/MM/yyyy, mặc định là 1 tháng trước đến hôm nay
    function parseDate(dateStr?: string): string | undefined {
      if (!dateStr) return undefined;
      const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [_, day, month, year] = match;
        return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
      }
      return dateStr;
    }
    let fromParsed = parseDate(since);
    let toParsed = parseDate(until);
    if (!fromParsed || !toParsed) {
      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      fromParsed = lastMonth.toISOString();
      toParsed = today.toISOString();
    }
    const data = await this.statService.getMemberPerformance(fromParsed, toParsed);
    console.log('Performance data:', data); // Log dữ liệu truyền sang view
    return { title: 'Team Performance Rankings', data, since: fromParsed, until: toParsed };
  }
}
