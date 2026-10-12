import { INestApplication, ValidationPipe } from '@nestjs/common';
import { isIP } from 'node:net';

/** Only explicitly named proxy peers may supply a client address. */
export function configureHttp(
  app: INestApplication,
  trustedProxies = process.env.STORE_TRUSTED_PROXIES ?? '',
) {
  const addresses = trustedProxies.trim()
    ? trustedProxies.split(',').map((ip) => ip.trim())
    : [];
  if (addresses.some((ip) => !isIP(ip)))
    throw new Error(
      'STORE_TRUSTED_PROXIES must contain only comma-separated IP addresses.',
    );
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', addresses.length ? addresses : false);
  server.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}
