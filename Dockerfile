# syntax=docker/dockerfile:1

FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS builder
COPY . .
# 如需在构建时注入变量，请提供 .env.production
COPY .env.production .env.production
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
