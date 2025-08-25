import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommitEntity } from './entities/stat.entity';

@Injectable()
export class StatService {
  constructor(
    @InjectRepository(CommitEntity)
    private readonly commitRepo: Repository<CommitEntity>,
  ) {}

  async saveCommits(commits: any[], repo: string, owner: string) {
    const entities = commits.map(commit => ({
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

  async getCommitsByUser(username: string) {
    return this.commitRepo.find({ where: { author_name: username } });
  }

  async getAllCommits() {
    return this.commitRepo.find();
  }
}
