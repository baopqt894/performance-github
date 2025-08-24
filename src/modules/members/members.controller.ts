// src/modules/members/members.controller.ts
import { Controller, Get, Post } from '@nestjs/common';
import { MembersService } from './members.service';
import { Member } from './entities/member.entity';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('sync')
  async syncFromGithub(): Promise<Member[]> {
    return this.membersService.fetchAndSaveMembers();
  }

  @Get()
  async getAll(): Promise<Member[]> {
    return this.membersService.findAll();
  }
}
