# syntax=docker/dockerfile:1.7
# One image for both apps; the container's command picks which one runs.
#   docker build -t kurotrace --build-arg NEXT_PUBLIC_SITE_URL=https://kurotrace.com .
#   docker run kurotrace npm run start -w @kurotrace/web     (or @kurotrace/admin)

FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/services/package.json packages/services/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# Public settings are baked into the browser code at build time.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ARG NEXT_PUBLIC_META_PIXEL_ID=""
ARG NEXT_PUBLIC_GOOGLE_TAG_ID=""
ARG NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO=""
ARG NEXT_PUBLIC_ADS_CONSENT="banner"
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_GOOGLE_TAG_ID=$NEXT_PUBLIC_GOOGLE_TAG_ID \
    NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO=$NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO \
    NEXT_PUBLIC_ADS_CONSENT=$NEXT_PUBLIC_ADS_CONSENT
RUN test -n "$NEXT_PUBLIC_SITE_URL" || (echo "Build with --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain" && exit 1)
RUN npm run db:generate \
 && npm run build -w @kurotrace/web \
 && npm run build -w @kurotrace/admin \
 && rm -rf apps/*/.next/cache

FROM base AS run
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/robots.txt').then(()=>process.exit(0),()=>process.exit(1))"
CMD ["npm", "run", "start", "-w", "@kurotrace/web"]
