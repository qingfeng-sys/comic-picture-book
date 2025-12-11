import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createServer } from './helpers/server';
import { POST as comicPost } from '@/app/api/comic/generate/route';

vi.mock('@/lib/imageGenerator', () => ({
  generateComicPages: vi.fn(async () => [
    { pageNumber: 1, imageUrl: 'http://img/1', text: 't1' },
  ]),
  generateComicPagesFromStoryboard: vi.fn(async () => [
    { pageNumber: 1, imageUrl: 'http://img/1', text: 't1' },
  ]),
}));

vi.mock('@/lib/imageStorage', () => ({
  saveImageToStorage: vi.fn(async (url: string, page: number) => ({
    url: `/comic-assets/p${page}.png`,
    fileName: `p${page}.png`,
    expiresAt: new Date().toISOString(),
  })),
}));

describe('API /api/comic/generate', () => {
  let server: any;

  beforeAll(() => {
    process.env.ENABLE_API_KEY_VERIFICATION = 'false';
    server = createServer(comicPost).listen();
  });

  afterAll(() => {
    server.close();
  });

  it('generates comic pages from script', async () => {
    const res = await request(server)
      .post('/api/comic/generate')
      .send({ scriptSegment: 'hello', startPageNumber: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.pages[0].imageUrl).toContain('/comic-assets/');
  });
});

