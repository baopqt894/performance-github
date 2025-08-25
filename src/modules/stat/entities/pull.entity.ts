import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pull_requests')
export class PullRequestEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column('bigint')
  pr_id: string;

  @Column()
  repo: string;

  @Column()
  owner: string;

  @Column('json')
  pr_raw: any;
}

@Entity('pull_request_reviews')
export class PullRequestReviewEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column('varchar')
  review_id: string;

  @Column('bigint')
  pr_id: string;

  @Column()
  repo: string;

  @Column()
  owner: string;

  @Column('json')
  review_raw: any;
}
