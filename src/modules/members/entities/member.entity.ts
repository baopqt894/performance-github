// src/modules/members/entities/member.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  githubId: number;

  @Column()
  login: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  htmlUrl: string;

  @Column({ default: false })
  siteAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
