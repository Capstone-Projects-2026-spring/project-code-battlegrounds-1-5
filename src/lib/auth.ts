import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nanoid } from "nanoid";
import { sendEmail } from "./email";

import { prisma } from "./prisma";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url, token }, request) => {
            void sendEmail({
                to: user.email,
                subject: 'Verify your email address',
                text: `Click the link to verify your email: ${url}`
            });
        },
        async afterEmailVerification(user, request) {
            // Run after-verification logic
            console.log(`Verified ${user.email}`);
        },
        sendOnSignUp: true,
        autoSignInAfterVerification: true
    },
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path.startsWith("/sign-up")) {
                const newSession = ctx.context.newSession;
                if (newSession) {
                    await prisma.user.update({
                        where: { id: newSession.user.id },
                        data: { friendCode: nanoid(8) }
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