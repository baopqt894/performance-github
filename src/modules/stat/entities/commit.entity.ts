import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('commits')
export class CommitEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column()
  sha: string;

  @Column()
  repo: string;

  @Column()
  owner: string;

  @Column()
  author_name: string;

  @Column()
  author_email: string;

  @Column()
  date: string;

  @Column()
  message: string;

  @Column('json', { nullable: true })
  parents: any;

  @Column('json', { nullable: true })
  commit_raw: any;
}
