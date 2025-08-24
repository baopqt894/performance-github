import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationModule } from './modules/organization/organization.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MembersModule } from './modules/members/members.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { GitHubModule } from './modules/github/github.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
        ssl: config.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
        migrationsRun: config.get<string>('RUN_MIGRATIONS') === 'true',
        logging: config.get<string>('ENABLE_ORM_LOGS') === 'true',
        extra: {
          max: parseInt(config.get<string>('DB_POOL_MAX') ?? '10', 10),
        },
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    OrganizationModule,
    MembersModule,
    RepositoriesModule,
    GitHubModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
