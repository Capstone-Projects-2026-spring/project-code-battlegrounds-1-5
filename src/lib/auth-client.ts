import { createAuthClient } from "better-auth/react"
export const authClient = createAuthClient({}) // no need to provide auth url, its read from env automagically