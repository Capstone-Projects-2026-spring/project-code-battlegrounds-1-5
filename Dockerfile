# Multi-stage Dockerfile for Next.js + Prisma app
# Use Debian-based image to ensure Prisma binaries work out-of-the-box

# TODO: this should use bun for installation and server starting

# 1) Base builder image: installs deps, generates Prisma client, builds Next app
FROM node:20-bookworm-slim AS builder

# Set working directory
WORKDIR /app

# Install system dependencies (optional but useful for native modules)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Enable Corepack to get Yarn
ENV COREPACK_ENABLE_AUTO_PIN=1
RUN corepack enable

# Copy dependency manifests
COPY package.json yarn.lock* ./

# Copy prisma schema before install because postinstall runs `prisma generate`
COPY prisma ./prisma

# Install dependencies (includes dev deps needed for build and prisma)
RUN yarn install --frozen-lockfile

# Copy the rest of the app source
COPY . .

# Build the Next.js app
ENV NODE_ENV=production
RUN yarn build

# 2) Runner image: minimal runtime with built app
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Make sure we have openssl for prisma
RUN apt-get update -y && apt-get install -y openssl

# Copy only the necessary build artifacts and node_modules from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose the port Next.js listens on
EXPOSE 8080

# Switch to non-root user
USER node

# Start the Next.js server
CMD ["sh", "-c", "yarn start -p $PORT -H 0.0.0.0"]