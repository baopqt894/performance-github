// // src/modules/activities/activities.module.ts
// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { HttpModule } from '@nestjs/axios';
// import { ScheduleModule } from '@nestjs/schedule';
// import { Activity } from './entities/activity.entity';
// import { ActivitiesService } from './activities.service';
// import { ActivitiesController } from './activities.controller';
// import { Member } from '../members/entities/member.entity';
// import { RepositoryEntity } from '../repositories/entities/repository.entity';

// @Module({
//   imports: [
//     HttpModule,
//     ScheduleModule.forRoot(),
//     TypeOrmModule.forFeature([Activity, Member, RepositoryEntity]),
//   ],
//   providers: [ActivitiesService],
//   controllers: [ActivitiesController],
//   exports: [ActivitiesService],
// })
// export class ActivitiesModule {}
