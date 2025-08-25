import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { configSwagger } from './configs/api-docs.config';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import * as hbs from 'hbs';
async function bootstrap() {
  const logger = new Logger(bootstrap.name);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const reflector = app.get(Reflector);

  // Register Handlebars helpers
  hbs.registerHelper('limit', function (arr, limit) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, limit);
  });

  hbs.registerHelper('add', function (a, b) {
    return Number(a) + Number(b);
  });

  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: '*',
  });

  configSwagger(app);

  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  // 🔥 Register helper eq
  hbs.registerHelper('eq', (a, b) => a === b);
  hbs.registerHelper('ne', (a, b) => a !== b);
  hbs.registerHelper('lt', (a, b) => a < b);
  hbs.registerHelper('gt', (a, b) => a > b);
  hbs.registerHelper('lte', (a, b) => a <= b);
  hbs.registerHelper('gte', (a, b) => a >= b);

  const port = process.env.PORT || 4000;
  await app.listen(port, () =>
    logger.log(`🚀 Server running on: http://localhost:${port}`),
  );
}
bootstrap();
