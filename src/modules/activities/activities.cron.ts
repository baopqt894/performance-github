// import { Injectable } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import { ActivitiesService } from './activities.service';

// @Injectable()
// export class ActivitiesCron {
//   constructor(private readonly svc: ActivitiesService) {}

//   @Cron(CronExpression.EVERY_DAY_AT_1AM)
//   async daily() {
//     await this.svc.syncYesterday();
//   }
// }
