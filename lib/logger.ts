import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

// 为避免 thread-stream 依赖问题，统一禁用 pretty，使用 JSON 输出
export const logger = pino({
  level,
  transport: undefined,
  base: undefined, // 不自动记录 pid/hostname，减少噪声
  timestamp: pino.stdTimeFunctions.isoTime,
});

