# syntax=docker/dockerfile:1

FROM node:26-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build --workspace apps/web

FROM node:26-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules node_modules
COPY --from=build /repo/apps/web/.next apps/web/.next
COPY --from=build /repo/apps/web/public apps/web/public
COPY --from=build /repo/apps/web/package.json apps/web/package.json
COPY --from=build /repo/apps/web/next.config.mjs apps/web/next.config.mjs
EXPOSE 3000
WORKDIR /repo/apps/web
CMD ["npx", "next", "start"]
