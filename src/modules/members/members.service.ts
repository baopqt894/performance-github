// src/modules/members/members.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';   // ✅ import đúng
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from './entities/member.entity';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MembersService {
  private readonly githubToken: string;
  private readonly githubOrg: string;

  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.githubToken = this.configService.get<string>('GITHUB_TOKEN') ?? '';
    this.githubOrg = this.configService.get<string>('GITHUB_ORG') ?? '';
  }

  async fetchAndSaveMembers(): Promise<Member[]> {
    const url = `https://api.github.com/orgs/${this.githubOrg}/members`;

    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: {
          Authorization: `token ${this.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }),
    );
    console.log(response)

    const members = response.data as any[];

    const entities: Member[] = [];

    for (const m of members) {
      let member = await this.memberRepository.findOne({
        where: { githubId: m.id },
      });

      if (!member) {
        member = this.memberRepository.create({
          githubId: m.id,
          login: m.login,
          avatarUrl: m.avatar_url,
          htmlUrl: m.html_url,
          siteAdmin: m.site_admin,
        });
      } else {
        member.login = m.login;
        member.avatarUrl = m.avatar_url;
        member.htmlUrl = m.html_url;
        member.siteAdmin = m.site_admin;
      }

      entities.push(await this.memberRepository.save(member));
    }

    return entities;
  }

  async findAll(): Promise<Member[]> {
    return this.memberRepository.find();
  }
}
