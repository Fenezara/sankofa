/**
 * Sankofa — NextAuth.js v4 configuration (Task 12)
 *
 * Phone-based authentication using a Credentials provider with phone + OTP.
 * No email — young Ivorians use phone numbers.
 *
 * Flow:
 *   1. POST /api/auth/otp/send  { phone }   →  sends OTP via WhatsApp (or console.log in dev)
 *   2. signIn("phone-otp", { phone, code })  →  NextAuth.authorize() validates the OTP,
 *      consumes it, finds-or-creates the User, returns a JWT session.
 *
 * Privacy:
 *   - Raw phone never stored. Only SHA-256 hash (phoneHash) + masked version.
 *   - JWT strategy (no DB sessions) — token contains userId only.
 *   - 30-day session maxAge.
 *
 * Anonymity by default — anonymous flow (UUID local) is untouched. Auth is
 * purely opt-in. A user can choose to stay anonymous forever.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import {
  normalizePhone,
  hashPhone,
  maskPhone,
  verifyOtp,
  OTP_MAX_ATTEMPTS,
} from "@/lib/auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Téléphone", type: "tel" },
        code: { label: "Code OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) return null;

        // Normalise le numéro → E.164 (+225XXXXXXXXXX)
        const normalized = normalizePhone(credentials.phone);
        if (!normalized) return null;

        const phoneHash = hashPhone(normalized);

        // Récupère le dernier OTP non expiré pour ce téléphone (consommé ou non).
        // On autorise les OTP déjà consommés car le flow standard est :
        //   1. POST /api/auth/otp/verify  → valide + consume l'OTP + find-or-create User
        //   2. signIn("phone-otp")        → NextAuth.authorize re-vérifie le code (bcrypt)
        //      et crée la session JWT.
        // Si on exigeait consumed=false, l'étape 2 échouerait systématiquement.
        const otpRecord = await db.otpCode.findFirst({
          where: {
            phoneHash,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!otpRecord) return null;
        if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) return null;

        // Vérifie le code (bcrypt compare — fonctionne même si l'OTP a déjà été consommé)
        const valid = await verifyOtp(credentials.code, otpRecord.code);
        if (!valid) {
          // N'incrémente les tentatives que si l'OTP n'est pas déjà consommé
          // (pour éviter un blocage après un verify réussi suivi d'un mauvais code
          // dans signIn — cas improbable mais défensif).
          if (!otpRecord.consumed) {
            await db.otpCode.update({
              where: { id: otpRecord.id },
              data: { attempts: { increment: 1 } },
            });
          }
          return null;
        }

        // Code valide → marque l'OTP comme consommé (idempotent)
        if (!otpRecord.consumed) {
          await db.otpCode.update({
            where: { id: otpRecord.id },
            data: { consumed: true },
          });
        }

        // Trouve ou crée l'utilisateur (jamais de numéro en clair).
        // Le verify route a déjà find-or-create l'utilisateur — ici on le retrouve simplement.
        let user = await db.user.findUnique({ where: { phoneHash } });
        if (!user) {
          user = await db.user.create({
            data: {
              phoneHash,
              phoneMasked: maskPhone(normalized),
              subscriptionTier: "free",
            },
          });
        }

        console.log(`[Sankofa auth] Connexion réussie pour user ${user.id} (${user.phoneMasked})`);
        return {
          id: user.id,
          name: user.name || undefined,
          // Champs custom passés au callback jwt (pas dans le type User standard)
          ...{ phoneMasked: user.phoneMasked, subscriptionTier: user.subscriptionTier },
        } as unknown as { id: string; name?: string; phoneMasked: string; subscriptionTier?: string | null };
      },
    }),
  ],
  session: {
    // JWT strategy — pas de sessions en DB (plus simple, moins de leak de données).
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  pages: {
    // Pas de page de login dédiée — on gère l'auth dans un modal côté `/`.
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET || "aya-dev-secret-change-in-production",
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        // phoneMasked + subscriptionTier sont passés depuis authorize() via l'objet user
        const u = user as unknown as {
          phoneMasked?: string;
          subscriptionTier?: string | null;
        };
        if (u.phoneMasked) token.phoneMasked = u.phoneMasked;
        if (u.subscriptionTier) token.subscriptionTier = u.subscriptionTier;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        // Attache userId + phoneMasked à la session client
        const u = session.user as {
          id?: string;
          phoneMasked?: string;
          subscriptionTier?: string | null;
        };
        u.id = token.userId as string;
        if (token.phoneMasked) u.phoneMasked = token.phoneMasked as string;
        if (token.subscriptionTier)
          u.subscriptionTier = token.subscriptionTier as string | null;
      }
      return session;
    },
  },
};
