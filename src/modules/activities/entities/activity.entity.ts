import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';
import { RepositoryEntity } from '../../repositories/entities/repository.entity';

export type ActivityType = 'commit' | 'pull_request' | 'issue' | 'review';

@Entity('activities')
@Index('uix_daily_bucket', ['memberId', 'repositoryId', 'type', 'activityDate'], { unique: true })
export class Activity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memberId' })
  member: Member;

  @Column()
  memberId: number;

  @ManyToOne(() => RepositoryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repositoryId' })
  repository: RepositoryEntity;

  @Column()
  repositoryId: number;

  @Column({ type: 'enum', enum: ['commit', 'pull_request', 'issue', 'review'] })
  type: ActivityType;

  @Column({ default: 0 })
  count: number;

  @Column({ default: 0 })
  additions: number;

  @Column({ default: 0 })
  deletions: number;

  @Column({ type: 'date' })
  activityDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
