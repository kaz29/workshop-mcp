import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // stdio では stdout が MCP の通信路になる。
  // console.log やロガーの出力が混ざると壊れるので、ログは出さない（必要なら console.error を使う）。
  await NestFactory.createApplicationContext(AppModule, { logger: false });
}

bootstrap();
