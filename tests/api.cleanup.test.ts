import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createServer } from './helpers/server';
import { GET as cleanupGet } from '@/app/api/comic/cleanup/route';

vi.mock('@/lib/imageStorage', () => ({
  cleanupExpiredImages: vi.fn(async () => 3),
}));

describe('API /api/comic/cleanup', () => {
  let server: any;

  beforeAll(() => {
    process.env.ENABLE_API_KEY_VERIFICATION = 'false';
    server = createServer(cleanupGet).listen();
  });

  afterAll(() => {
    server.close();
  });

  it('cleans expired images', async () => {
    const res = await request(server).get('/api/comic/cleanup').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deletedCount).toBe(3);
  });
});

