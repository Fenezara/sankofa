/**
 * GET    /api/reminders          — liste les rappels de l'utilisateur
 * POST   /api/reminders          — crée un nouveau rappel
 * DELETE /api/reminders?id={id}  — supprime un rappel
 * PATCH  /api/reminders          — modifie un rappel (snooze, cancel)
 *
 * Types de rappels :
 *   - 'tpe_test'       : Test VIH J+7 après TPE 72h
 *   - 'pilule'         : Rappel prise pilule quotidienne
 *   - 'depistage_ist'  : Dépistage IST annuel
 *   - 'suivi_consult'  : Suivi post-consultation
 *   - 'custom'         : Rappel personnalisé
 *
 * Fonctionne en mode anonyme (anonymousId) OU authentifié (userId).
 * Si authentifié, persiste en DB (visible cross-device). Sinon, localStorage-only
 * (le serveur renvoie le rappel créé mais ne le persiste pas — c'est au client
 * de le stocker localement).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

const VALID_TYPES = [
  "tpe_test",
  "pilule",
  "depistage_ist",
  "suivi_consult",
  "custom",
] as const;
type ReminderType = (typeof VALID_TYPES)[number];

interface CreateReminderBody {
  anonymousId?: string;
  type?: string;
  title?: string;
  message?: string;
  scheduledFor?: string; // ISO date
  timezone?: string;
}

interface UpdateReminderBody {
  id: string;
  status?: "pending" | "sent" | "snoozed" | "cancelled";
  scheduledFor?: string; // pour snooze
  snoozeCount?: number;
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  const url = new URL(req.url);
  const anonymousId = url.searchParams.get("anonymousId") ?? "";
  const status = url.searchParams.get("status"); // filter by status

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { error: "Authentification ou anonymousId requis." },
      { status: 400 },
    );
  }

  try {
    const where: Record<string, unknown> = {};
    if (userId) {
      where.userId = userId;
    } else {
      where.anonymousId = anonymousId;
      where.userId = null; // ne pas remonter les reminders d'un user authentifié
    }
    if (status) where.status = status;

    const reminders = await db.reminder.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
      take: 50,
    });

    return NextResponse.json({ reminders });
  } catch (err) {
    console.error("[Sankofa reminders GET] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  let body: CreateReminderBody;
  try {
    body = (await req.json()) as CreateReminderBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const anonymousId = (body.anonymousId ?? "").trim();
  const type = body.type as ReminderType;
  const title = (body.title ?? "").trim();
  const message = (body.message ?? "").trim();
  const scheduledForStr = body.scheduledFor;
  const timezone = (body.timezone ?? "Africa/Abidjan").trim();

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { error: "Authentification ou anonymousId requis." },
      { status: 400 },
    );
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Type invalide. Valid: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (!title || !message || !scheduledForStr) {
    return NextResponse.json(
      { error: "title, message, scheduledFor sont requis." },
      { status: 400 },
    );
  }

  const scheduledFor = new Date(scheduledForStr);
  if (isNaN(scheduledFor.getTime())) {
    return NextResponse.json(
      { error: "scheduledFor doit être une date ISO valide." },
      { status: 400 },
    );
  }
  if (scheduledFor.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "scheduledFor doit être dans le futur." },
      { status: 400 },
    );
  }

  try {
    // Si pas authentifié → on renvoie le rappel créé (le client le stocke en localStorage)
    if (!userId) {
      return NextResponse.json({
        reminder: {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          anonymousId,
          userId: null,
          type,
          title,
          message,
          scheduledFor: scheduledFor.toISOString(),
          timezone,
          status: "pending",
          snoozeCount: 0,
          localOnly: true,
        },
      });
    }

    // Authentifié → persiste en DB
    const reminder = await db.reminder.create({
      data: {
        userId,
        anonymousId,
        type,
        title,
        message,
        scheduledFor,
        timezone,
      },
    });

    return NextResponse.json({ reminder });
  } catch (err) {
    console.error("[Sankofa reminders POST] Error:", err);
    return NextResponse.json(
      { error: "Erreur de persistance." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const userId = await getAuthenticatedUserId();
  let body: UpdateReminderBody;
  try {
    body = (await req.json()) as UpdateReminderBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id est requis." }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json(
      { error: "Authentification requise pour modifier un rappel." },
      { status: 401 },
    );
  }

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.scheduledFor) {
    const d = new Date(body.scheduledFor);
    if (!isNaN(d.getTime())) data.scheduledFor = d;
  }
  if (typeof body.snoozeCount === "number") data.snoozeCount = body.snoozeCount;

  try {
    const reminder = await db.reminder.updateMany({
      where: { id: body.id, userId },
      data,
    });

    if (reminder.count === 0) {
      return NextResponse.json(
        { error: "Rappel introuvable ou non autorisé." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, updated: reminder.count });
  } catch (err) {
    console.error("[Sankofa reminders PATCH] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const userId = await getAuthenticatedUserId();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id est requis." }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json(
      { error: "Authentification requise pour supprimer un rappel." },
      { status: 401 },
    );
  }

  try {
    const result = await db.reminder.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Rappel introuvable ou non autorisé." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (err) {
    console.error("[Sankofa reminders DELETE] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 },
    );
  }
}
