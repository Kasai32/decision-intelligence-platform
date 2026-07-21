# syntax=docker/dockerfile:1

FROM node:26-alpine AS base
WORKDIR /repo

FROM base AS deps
# python3/make/g++ are required to compile argon2's native binding (see ADR-0005 / DECISION_LOG.md)
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run build --workspace apps/api

FROM node:26-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/prisma apps/api/prisma
EXPOSE 3001
WORKDIR /repo/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
