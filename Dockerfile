# reel-engine: blog -> faceless 1080x1920 Shorts/Reels (HyperFrames render, HTTP API on :8080)
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    HYPERFRAMES_NO_TELEMETRY=1 \
    HYPERFRAMES_NO_UPDATE_CHECK=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CONTAINER=true \
    NODE_ENV=production

# ffmpeg for clip prep/probing; Chrome runtime libs; fonts (incl. Devanagari fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl ffmpeg \
      libgbm1 libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 \
      libcups2 libasound2 libpangocairo-1.0-0 libxshmfence1 libgtk-3-0 \
      fonts-noto-core fonts-noto-color-emoji fontconfig \
    && rm -rf /var/lib/apt/lists/* && fc-cache -f

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Pinned chrome-headless-shell enables HyperFrames' fast deterministic BeginFrame capture.
# Same build HyperFrames 0.8.161 auto-installs (verified BeginFrame capture works with it).
RUN npx --yes @puppeteer/browsers@3.2.5 install chrome-headless-shell@152.0.7977.30 --path /opt/chrome \
    && ln -s "$(find /opt/chrome -name chrome-headless-shell -type f | head -1)" /usr/local/bin/chrome-headless-shell
ENV PRODUCER_HEADLESS_SHELL_PATH=/usr/local/bin/chrome-headless-shell

COPY src ./src
COPY template ./template
COPY config ./config

RUN mkdir -p /data/out /data/cache && chown -R node:node /data /app
USER node
ENV WORK_DIR=/data/out CACHE_DIR=/data/cache PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD curl -fs http://localhost:8080/health || exit 1
CMD ["node", "src/server.js"]
