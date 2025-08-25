import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatController } from './stat.controller';
import { StatService } from './stat.service';
import { CommitEntity } from './entities/stat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommitEntity])],
  controllers: [StatController],
  providers: [StatService],
})
export class StatModule {}
