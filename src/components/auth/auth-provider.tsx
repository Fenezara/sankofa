"use client";

/**
 * Sankofa — AuthProvider (Task 12)
 *
 * Thin wrapper around NextAuth.js SessionProvider, plus re-exports of the
 * hooks/functions the rest of the app needs.
 *
 * Wrap the app once in layout.tsx:
 *   <AuthProvider> {children} </AuthProvider>
 *
 * Then in any client component:
 *   import { useSession, signIn, signOut } from "@/components/auth/auth-provider";
 *
 * Hydration-safe : SessionProvider uses "loading" status on first render
 * (server-side) and resolves to "authenticated" | "unauthenticated" on mount.
 */

import * as React from "react";
import {
  SessionProvider,
  useSession,
  signIn,
  signOut,
  type SessionProviderProps,
} from "next-auth/react";

export function AuthProvider({
  children,
  ...props
}: SessionProviderProps) {
  return <SessionProvider {...props}>{children}</SessionProvider>;
}

export { useSession, signIn, signOut };
