import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nanoid } from "@/lib/nanoid";

import { prisma } from "./prisma";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true
    },
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path.startsWith("/sign-up")) {
                const newSession = ctx.context.newSession;
                if (newSession) {
                    await prisma.user.update({
                        where: { id: newSession.user.id },
                        data: { friendCode: nanoid(6) }
                    });
                    await prisma.party.create({
                        data: {
                            id: nanoid(6),
                            ownerId: newSession.user.id,
                        },
                    });
                }
            }
        }),
    }
});