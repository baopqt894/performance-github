import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('repositories')
export class RepositoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  githubId: number;

  @Column()
  name: string;

  @Column()
  fullName: string;

  @Column()
  private: boolean;

  @Column()
  htmlUrl: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'timestamp' })
  updatedAt: Date;
}
