import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/exceptions/all-exceptions.filter';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('should return a health check result with status ok', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', () => {
      return request(app.getHttpServer())
        .get('/api/v1/nonexistent-route')
        .expect(404)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });
  });

  describe('Validation', () => {
    it('POST /api/v1/agent/runs — should return 400 for missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/agent/runs')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('POST /api/v1/repos — should return 400 for invalid cloneUrl', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repos')
        .send({ name: 'api', fullName: 'buntu/api', cloneUrl: 'not-a-url' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
        });
    });
  });
});
