FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# IMPORTANT: Prevent Puppeteer from downloading Chromium (already included in base image)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Configure npm with longer timeouts and offline-first strategy
RUN npm config set fetch-timeout 120000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5

# Copy only package files first for better caching
COPY apps/renderer/package.json ./

# Install dependencies (use npm install since we may not have lock file)
RUN npm install --omit=dev --prefer-offline

# Copy rest of renderer source
COPY apps/renderer .

CMD ["node", "index.js"]
