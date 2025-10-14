import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationModule } from './modules/organization/organization.module';
import { MembersModule } from './modules/members/members.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { GitHubModule } from './modules/github/github.module';
import { StatModule } from './modules/stat/stat.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

@Module({
  imports: [
    // ✅ Load .env theo môi trường (ưu tiên .env.production hoặc .env.development)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
    }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        ssl:
          config.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
        migrationsRun: config.get<string>('RUN_MIGRATIONS') === 'true',
        logging: config.get<string>('ENABLE_ORM_LOGS') === 'true',
        extra: {
          max: parseInt(config.get<string>('DB_POOL_MAX') ?? '10', 10),
        },
      }),
    }),

    // ⚠️ Chỉ thêm ServeStatic nếu thực sự cần (đừng chặn API route)
    // ServeStaticModule.forRoot({
    //   rootPath: join(__dirname, '..', 'public'),
    //   exclude: ['/api*', '/stat*', '/performance*'],
    // }),

    OrganizationModule,
    MembersModule,
    RepositoriesModule,
    GitHubModule,
    StatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
