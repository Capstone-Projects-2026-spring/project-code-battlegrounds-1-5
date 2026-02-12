# Multi-stage Dockerfile for Next.js + Prisma app (Bun-only)
# Use Debian-based Bun image to ensure Prisma binaries work out-of-the-box

# 1) Base builder image: installs deps, generates Prisma client, builds Next app
FROM oven/bun:1-debian AS builder

# Set working directory
WORKDIR /app

# make sure prisma client is generated
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db" # dummy var just to be able to generate it
ENV DATABASE_URL=$DATABASE_URL

# Install system dependencies (optional but useful for native modules / Prisma)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json bun.lock* ./

# Copy prisma schema before install because postinstall runs `prisma generate`
COPY prisma ./prisma

# Install dependencies (includes dev deps needed for build and prisma)
RUN bun install --frozen-lockfile

# Copy the rest of the app source
COPY . .

RUN bunx prisma generate

# Build the Next.js app
ENV NODE_ENV=production
RUN bun run build

# 2) Runner image: minimal runtime with built app
FROM oven/bun:1-debian AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Make sure we have openssl for prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy only the necessary build artifacts and node_modules from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose the port Next.js listens on
EXPOSE 8080

# Start the Next.js server with Bun
CMD ["sh", "-c", "bun run start -p ${PORT:-8080} -H 0.0.0.0"]
