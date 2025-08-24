import { Controller, Get, Query } from '@nestjs/common';
import { OrganizationService } from './organization.service';

@Controller('organization')
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) { }

    @Get('info')
    async getInfo(@Query('org') org?: string) {
        return this.organizationService.getOrganizationInfo(org || process.env.ORG_NAME!);
    }

    @Get('members')
    async getMembers(@Query('org') org?: string) {
        return this.organizationService.getOrganizationMembers(org || process.env.ORG_NAME!);
    }

}
