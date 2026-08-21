/**
 * GET /api/health/alerts
 *
 * Alertes santé publique actives (épidémies, rappels vaccins, campagnes).
 * Affichées dans l'app pour informer les jeunes.
 *
 * Query: ?domain=xxx&severity=xxx&region=xxx
 *
 * Response: {
 *   alerts: Array<{ id, title, message, severity, domain, region, source, endsAt? }>,
 *   count
 * }
 *
 * Pour le MVP : seed d'alertes statiques. En production : DB HealthAlert + API MinSante.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface HealthAlert {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  domain: string;
  region: string | null;
  source: string;
  startsAt: string;
  endsAt: string | null;
}

// Seed d'alertes statiques (MVP). En production : db.healthAlert.findMany({ where: { active: true } })
const STATIC_ALERTS: HealthAlert[] = [
  {
    id: "alert-vaccin-hpv",
    title: "Vaccination HPV gratuite pour les filles 9-14 ans",
    message:
      "Le programme national de vaccination contre le HPV (papillomavirus) est gratuit pour les filles de 9 à 14 ans en Côte d'Ivoire. Prévient le cancer du col de l'utérus. Renseigne-toi au centre de santé le plus proche.",
    severity: "info",
    domain: "SSR",
    region: null, // national
    source: "MinSante CI",
    startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: null,
  },
  {
    id: "alert-palu-saison-pluies",
    title: "Paludisme : saison des pluies, redoublez de vigilance",
    message:
      "La saison des pluies augmente le risque de paludisme. Dors sous moustiquaire imprégnée, consulte vite si fièvre + maux de tête. Test gratuit dans les centres de santé.",
    severity: "warning",
    domain: "epidemic",
    region: null,
    source: "PNLP CI",
    startsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-depistage-vih",
    title: "Dépistage VIH gratuit dans tous les CDV",
    message:
      "Le dépistage du VIH est gratuit dans tous les Centres de Conseil et Dépistage Volontaire (CDV) et à l'AIBEF. 15-24 ans = tranche prioritaire. Ne reste pas dans le doute.",
    severity: "info",
    domain: "SSR",
    region: null,
    source: "PNLS CI",
    startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: null,
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const severity = url.searchParams.get("severity");
  const region = url.searchParams.get("region");

  let alerts = [...STATIC_ALERTS];

  if (domain && domain !== "all") {
    alerts = alerts.filter((a) => a.domain === domain);
  }
  if (severity) {
    alerts = alerts.filter((a) => a.severity === severity);
  }
  if (region) {
    alerts = alerts.filter((a) => a.region === null || a.region === region);
  }

  // Trier par sévérité (critical > warning > info)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return NextResponse.json({
    alerts,
    count: alerts.length,
  });
}
