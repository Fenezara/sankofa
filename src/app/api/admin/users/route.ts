/**
 * GET /api/admin/users
 *
 * Liste des utilisateurs (admin only — TODO: check role admin).
 * Query: ?limit=50&offset=0&search=xxx
 *
 * Response: {
 *   users: Array<{ id, phoneMasked, name, subscriptionTier, createdAt, _count }>,
 *   total, limit, offset
 * }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentification admin requise." }, { status: 401 });
  }
  // TODO: vérifier que l'utilisateur est admin (role-based — pas encore implémenté)

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
  const search = url.searchParams.get("search")?.trim();

  try {
    const where = search
      ? {
          OR: [
            { phoneMasked: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          phoneMasked: true,
          name: true,
          subscriptionTier: true,
          subscriptionUntil: true,
          createdAt: true,
          _count: {
            select: {
              conversations: true,
              reminders: true,
              teleconsultations: true,
              testimonies: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[Sankofa admin/users] Error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
