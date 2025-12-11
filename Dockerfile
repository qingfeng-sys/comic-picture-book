# syntax=docker/dockerfile:1

FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS builder
COPY . .
ARG ENV_FILE=.env.production
# 如果未提供真实的 .env.production，则使用示例文件，避免构建失败
RUN if [ -f "$ENV_FILE" ]; then cp "$ENV_FILE" .env.production; else cp config/env.production.example .env.production; fi
ENV NODE_ENV=production
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

VOLUME ["/app/public/comic-assets"]
EXPOSE 3000
CMD ["npm", "run", "start"]
