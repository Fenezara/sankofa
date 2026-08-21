/**
 * NextAuth.js catch-all route handler.
 *
 * Mounts all auth endpoints under /api/auth/* (signin, signout, session, csrf, etc.).
 * The credentials provider is wired in `src/lib/next-auth.ts`.
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/next-auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
