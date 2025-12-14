import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createServer } from './helpers/server';
import { POST as scriptPost } from '@/app/api/script/generate/route';

vi.mock('@/lib/storyGenerator', () => ({
  generateStoryScript: vi.fn(async () => ({ content: 'mock-script', provider: 'dashscope', model: 'deepseek-v3.2' })),
  generateStoryboard: vi.fn(async () => ({
    storyboard: { frames: [] },
    provider: 'dashscope',
    providers: { outline: 'qwen-flash', script: 'deepseek-v3.2', storyboard: 'qwen3-max' },
  })),
  continueStoryConversation: vi.fn(async () => ({ content: 'mock-script-continued', provider: 'dashscope', model: 'deepseek-v3.2' })),
  generateOutline: vi.fn(async () => ({ outline: { overview: { title: 't', logline: 'l' }, chapters: [{ chapter_id: 1, title: 'c', summary: 's' }], characters: [{ name: 'a', role: '主角', description: 'd' }] }, providers: { outline: 'qwen-flash' } })),
  generateScriptFromOutline: vi.fn(async () => ({ script: 'mock-script', providers: { script: 'deepseek-v3.2' } })),
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

