---
sidebar_position: 3
title: Prisma Client
---

# Prisma Client — `src/lib/prisma.ts`

Singleton `PrismaClient` using the native `PrismaPg` adapter. Shared across all server-side code. Requires `DATABASE_URL` to be set before first import.

## Fields

| Name | Type | Visibility | Description |
|---|---|---|---|
| `adapter` | `PrismaPg` | private | PostgreSQL adapter constructed from `DATABASE_URL`. |
| `prisma` | `PrismaClient` | public | ORM client. Import this everywhere you need database access. |

## Models

| Model | Table | PK type | Notes |
|---|---|---|---|
| `User` | `user` | `String` | `email` is unique. Cascade-deletes `Session` and `Account`. |
| `Session` | `session` | `String` | `token` is unique. Expires at `expiresAt`. |
| `Account` | `account` | `String` | OAuth or credential record. FK to `User`. |
| `Verification` | `verification` | `String` | Short-lived token for email verification. |
| `InfraTestKv` | `infra_test_kv` | `BigInt` | Infra connectivity test only. Do not use in application logic. |

## Preconditions

- `process.env.DATABASE_URL` must be a valid PostgreSQL connection string.
- All calls must be `await`ed.

## Error handling

| Error | When | Recommended response |
|---|---|---|
| `PrismaClientKnownRequestError` P2002 | Unique constraint violated (e.g., duplicate email). | `409 Conflict` |
| `PrismaClientKnownRequestError` P2025 | Record not found on update/delete. | `404 Not Found` |
| `PrismaClientInitializationError` | DB unreachable or `DATABASE_URL` missing. | Log + `500 Internal Server Error` |

`upsert`, `create`, and `update` are **not** idempotent by default. Callers that need idempotency must catch `P2002` and handle it.

## Example

```typescript
import { prisma } from "@/lib/prisma";

const user = await prisma.user.findUnique({
  where: { email: "alice@example.com" },
});

await prisma.infraTestKv.upsert({
  where: { id: BigInt(1) },
  update: { val: "updated" },
  create: { id: BigInt(1), val: "created" },
});
```
