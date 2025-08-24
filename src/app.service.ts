// src/app.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.dataSource.query('SELECT 1');
      console.log('✅ Database connected successfully!');
    } catch (err) {
      console.error('❌ Database connection failed:', err);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }
}
