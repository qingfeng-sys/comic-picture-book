# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# 1. 安装基础依赖（包含 openssl）
RUN apk add --no-cache libc6-compat openssl

# 2. 安装依赖阶段
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

# 修复网络问题：使用国内镜像源
RUN npm config set registry https://registry.npmmirror.com
RUN npm ci

# 3. 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 确保 public 目录及其子目录存在，防止构建失败
RUN mkdir -p public/comic-assets
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# 4. 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]