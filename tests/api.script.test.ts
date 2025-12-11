import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createServer } from './helpers/server';
import { POST as scriptPost } from '@/app/api/script/generate/route';

vi.mock('@/lib/deepseek', () => ({
  generateScriptWithDeepSeek: vi.fn(async () => 'mock-script'),
  generateStoryboardWithDeepSeek: vi.fn(async () => ({ frames: [] })),
  continueConversation: vi.fn(async () => 'mock-script-continued'),
}));

describe('API /api/script/generate', () => {
  let server: any;

  beforeAll(() => {
    process.env.ENABLE_API_KEY_VERIFICATION = 'false';
    server = createServer(scriptPost).listen();
  });

  afterAll(() => {
    server.close();
  });

  it('returns script content', async () => {
    const res = await request(server)
      .post('/api/script/generate')
      .send({ prompt: 'hello' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.script).toBe('mock-script');
  });
});

