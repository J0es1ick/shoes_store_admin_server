import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureHttp } from './app/configure-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  configureHttp(app);
  await app.listen(
    process.env.STORE_PORT ?? process.env.SERVER_PORT ?? 3001,
    process.env.STORE_HOST || '127.0.0.1',
  );
}
bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
