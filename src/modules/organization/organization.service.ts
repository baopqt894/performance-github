import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OrganizationService {
  private readonly githubApi = 'https://api.github.com';

  async getOrganizationInfo(orgName: string) {
    const token = process.env.GITHUB_TOKEN;

    const res = await axios.get(`${this.githubApi}/orgs/${orgName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return res.data;
  }

  async getOrganizationMembers(orgName: string) {
    const token = process.env.GITHUB_TOKEN;

    const res = await axios.get(`${this.githubApi}/orgs/${orgName}/members`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return res.data;
  }
}
