import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

(async () => {
  const whitelist = [
    'http://localhost:4200', // Admin panel
    'http://localhost:4202', // Blog front
    'http://localhost:8080', // Blog front
    'http://127.0.0.1:8080', // Blog front
    'http://localhost:4000' // Blog production front
  ];

  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: true
  });
  const port = process.env.API_PORT || 4201;

  app.setGlobalPrefix('/api');

  // Increase payload limits for large dataset uploads (up to 2GB)
  app.use(json({ limit: '2gb' }));
  app.use(urlencoded({ extended: true, limit: '2gb' }));

  app.enableCors({
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    origin: whitelist,
    credentials: true
  });

  const server = await app.listen(port, () => {
    console.log(`Personal blog server started on port ${port}`);
  });

  // Increase timeout for large file uploads (10 minutes)
  server.setTimeout(600000);
})();
