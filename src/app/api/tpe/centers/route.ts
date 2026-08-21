/**
 * GET /api/tpe/centers
 *
 * Liste des centres TPE (Traitement Post-Exposition) en Côte d'Ivoire.
 * Remplace la liste hardcoded dans tpe-section.tsx — source de vérité unique.
 *
 * Query params (optionnels):
 *   ?domain=urgences|ist|psy|addicto  — filtre par domaine
 *   ?city=Abidjan|Bouaké|...         — filtre par ville
 *   ?lat=5.36&lng=-4.01              — tri par distance (géolocalisation)
 *
 * Response: {
 *   centers: Array<{
 *     id, name, city, area, domain, specialty, note, phone, hours,
 *     address, lat?, lng?, mapsUrl, emergency
 *   }>
 * }
 *
 * Les données sont stockées en DB (table HealthCenter) ou en mémoire
 * (constante) pour le MVP. En production : DB + API Maps pour horaires temps réel.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface TpeCenter {
  id: string;
  name: string;
  city: string;
  area: string;
  domain: "urgences" | "ist" | "psy" | "addicto";
  specialty: string;
  note: string;
  phone: string;
  hours: string;
  address: string;
  lat?: number;
  lng?: number;
  mapsUrl: string;
  emergency: boolean;
}

const TPE_CENTERS: TpeCenter[] = [
  {
    id: "chu-cocody",
    name: "CHU de Cocody",
    city: "Abidjan",
    area: "Cocody",
    domain: "urgences",
    specialty: "Urgences médicales 24/7",
    note: "Référence pour TPE 72h, urgences sexuelles, VIH",
    phone: "27 22 44 00 00",
    hours: "24h/24, 7j/7",
    address: "Cocody, Abidjan",
    lat: 5.3599,
    lng: -4.0083,
    mapsUrl: "https://maps.google.com/?q=CHU+Cocody+Abidjan",
    emergency: true,
  },
  {
    id: "chu-treichville",
    name: "CHU de Treichville",
    city: "Abidjan",
    area: "Treichville",
    domain: "urgences",
    specialty: "Urgences + Dermatologie-IST",
    note: "Service IST référent, dépistage anonyme",
    phone: "27 21 24 00 00",
    hours: "24h/24, 7j/7",
    address: "Treichville, Abidjan",
    lat: 5.2925,
    lng: -4.0122,
    mapsUrl: "https://maps.google.com/?q=CHU+Treichville+Abidjan",
    emergency: true,
  },
  {
    id: "aibef-abidjan",
    name: "AIBEF Abidjan",
    city: "Abidjan",
    area: "Cocody (Riviera)",
    domain: "ist",
    specialty: "Planning familial, IST, TPE",
    note: "Dépistage VIH/IST gratuit pour les jeunes",
    phone: "27 22 44 09 09",
    hours: "Lun-Ven 8h-17h, Sam 8h-12h",
    address: "Riviera Golf, Cocody, Abidjan",
    lat: 5.3801,
    lng: -3.9768,
    mapsUrl: "https://maps.google.com/?q=AIBEF+Abidjan",
    emergency: false,
  },
  {
    id: "chu-yopougon",
    name: "CHU de Yopougon",
    city: "Abidjan",
    area: "Yopougon",
    domain: "urgences",
    specialty: "Urgences + Maternité",
    note: "Service urgences + gynéco, TPE 72h",
    phone: "27 23 51 00 00",
    hours: "24h/24, 7j/7",
    address: "Yopougon, Abidjan",
    lat: 5.2833,
    lng: -4.0833,
    mapsUrl: "https://maps.google.com/?q=CHU+Yopougon",
    emergency: true,
  },
  {
    id: "chu-bouake",
    name: "CHU de Bouaké",
    city: "Bouaké",
    area: "Centre",
    domain: "urgences",
    specialty: "Urgences régionales",
    note: "CHU régional — TPE 72h, urgences",
    phone: "27 31 63 00 00",
    hours: "24h/24, 7j/7",
    address: "Bouaké",
    lat: 7.6906,
    lng: -5.0303,
    mapsUrl: "https://maps.google.com/?q=CHU+Bouake",
    emergency: true,
  },
  {
    id: "chu-sanpedro",
    name: "CHU de San-Pédro",
    city: "San-Pédro",
    area: "Sud-Ouest",
    domain: "urgences",
    specialty: "Urgences régionales",
    note: "CHU régional — TPE 72h, dépistage",
    phone: "27 34 71 00 00",
    hours: "24h/24, 7j/7",
    address: "San-Pédro",
    lat: 4.7485,
    lng: -6.6363,
    mapsUrl: "https://maps.google.com/?q=CHU+San-Pedro",
    emergency: true,
  },
  {
    id: "chu-korhogo",
    name: "CHU de Korhogo",
    city: "Korhogo",
    area: "Nord",
    domain: "urgences",
    specialty: "Urgences régionales",
    note: "CHU régional — TPE 72h, accès Nord CI",
    phone: "27 36 86 00 00",
    hours: "24h/24, 7j/7",
    address: "Korhogo",
    lat: 9.4575,
    lng: -5.6295,
    mapsUrl: "https://maps.google.com/?q=CHU+Korhogo",
    emergency: true,
  },
  {
    id: "chu-daloa",
    name: "CHU de Daloa",
    city: "Daloa",
    area: "Centre-Ouest",
    domain: "urgences",
    specialty: "Urgences régionales",
    note: "CHU régional — TPE, dépistage IST",
    phone: "27 32 77 00 00",
    hours: "24h/24, 7j/7",
    address: "Daloa",
    lat: 6.8772,
    lng: -6.4486,
    mapsUrl: "https://maps.google.com/?q=CHU+Daloa",
    emergency: true,
  },
];

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const city = url.searchParams.get("city");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  let centers = [...TPE_CENTERS];

  if (domain && domain !== "all") {
    centers = centers.filter((c) => c.domain === domain);
  }
  if (city) {
    const cityLower = city.toLowerCase();
    centers = centers.filter((c) => c.city.toLowerCase().includes(cityLower));
  }

  // Tri par distance si géolocalisation fournie
  if (lat && lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      centers = centers
        .filter((c) => c.lat !== undefined && c.lng !== undefined)
        .map((c) => ({
          ...c,
          distance: haversineDistance(latNum, lngNum, c.lat!, c.lng!),
        }))
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }
  }

  // Centres d'urgence en premier
  centers.sort((a, b) => {
    if (a.emergency && !b.emergency) return -1;
    if (!a.emergency && b.emergency) return 1;
    return 0;
  });

  return NextResponse.json({
    centers,
    count: centers.length,
    emergencyNumbers: {
      samu: "185",
      ecoutePsy: "143",
      police: "110",
    },
  });
}
