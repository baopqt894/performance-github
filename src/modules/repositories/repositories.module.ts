// src/repositories/repositories.module.ts
import { Module } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { RepositoriesController } from './repositories.controller';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoryEntity } from './entities/repository.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([RepositoryEntity])],
  controllers: [RepositoriesController],
  providers: [RepositoriesService],
})
export class RepositoriesModule {}
