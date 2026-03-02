# Build stage
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsup.config.ts ./
COPY src/ src/
RUN npm run build

# Production stage
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist/ dist/
COPY gh-extension ./

EXPOSE 3000
ENTRYPOINT ["node", "dist/cli.js"]
