# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run build --workspace apps/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
