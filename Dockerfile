# multistage Dockerfile with builder and runner

# TODO: this could use cleaning up and a from scratch runner stage

# ================ builder stage ================
FROM oven/bun:1-debian AS builder

# set working dir
WORKDIR /app

# make sure prisma client is generated (can use a dummy var, but it needs to be set)
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV DATABASE_URL=$DATABASE_URL

# make sure we get openssl for prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# copy dependency files
COPY package.json bun.lock* ./

# copy prisma schema BEFORE install (otherwise prisma will complain)
COPY prisma ./prisma

# install all deps
RUN bun install --frozen-lockfile

# copy the rest of the project
COPY . .

# generate prisma client
RUN bunx prisma generate

# build!
ENV NODE_ENV=production
RUN bun run build

# ================ runner image ================
FROM oven/bun:1-debian AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# make sure we get openssl for prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# copy deps # TODO: this copies all deps, not just needed ones
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# expose nextjs port
EXPOSE 8080

# start server
CMD ["sh", "-c", "bun run start -p ${PORT:-8080} -H 0.0.0.0"]
