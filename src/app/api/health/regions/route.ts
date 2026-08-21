/**
 * GET /api/health/regions
 *
 * Liste des régions de Côte d'Ivoire + centres de santé par région.
 * Source de vérité pour la carte TPE interactive.
 *
 * Response: {
 *   regions: Array<{
 *     name, capital, lat, lng,
 *     centers: Array<{ id, name, domain, phone, emergency }>
 *   }>
 * }
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RegionCenter {
  id: string;
  name: string;
  domain: string;
  phone: string;
  emergency: boolean;
}

interface Region {
  name: string;
  capital: string;
  lat: number;
  lng: number;
  centers: RegionCenter[];
}

const REGIONS: Region[] = [
  {
    name: "Autonome d'Abidjan",
    capital: "Abidjan",
    lat: 5.3599,
    lng: -4.0083,
    centers: [
      { id: "chu-cocody", name: "CHU de Cocody", domain: "urgences", phone: "27 22 44 00 00", emergency: true },
      { id: "chu-treichville", name: "CHU de Treichville", domain: "urgences", phone: "27 21 24 00 00", emergency: true },
      { id: "chu-yopougon", name: "CHU de Yopougon", domain: "urgences", phone: "27 23 51 00 00", emergency: true },
      { id: "aibef-abidjan", name: "AIBEF Abidjan", domain: "ist", phone: "27 22 44 09 09", emergency: false },
    ],
  },
  {
    name: "Gôh-Djiboua",
    capital: "Gagnoa",
    lat: 6.1319,
    lng: -5.9489,
    centers: [
      { id: "chu-daloa", name: "CHU de Daloa", domain: "urgences", phone: "27 32 77 00 00", emergency: true },
    ],
  },
  {
    name: "Hambol",
    capital: "Katiola",
    lat: 8.1497,
    lng: -5.0833,
    centers: [],
  },
  {
    name: "Bas-Sassandra",
    capital: "San-Pédro",
    lat: 4.7485,
    lng: -6.6363,
    centers: [
      { id: "chu-sanpedro", name: "CHU de San-Pédro", domain: "urgences", phone: "27 34 71 00 00", emergency: true },
    ],
  },
  {
    name: "Lôh-Djiboua",
    capital: "Divo",
    lat: 5.8333,
    lng: -5.3667,
    centers: [],
  },
  {
    name: "Porêt",
    capital: "Guiglo",
    lat: 6.5431,
    lng: -8.0647,
    centers: [],
  },
  {
    name: "Savanes",
    capital: "Korhogo",
    lat: 9.4575,
    lng: -5.6295,
    centers: [
      { id: "chu-korhogo", name: "CHU de Korhogo", domain: "urgences", phone: "27 36 86 00 00", emergency: true },
    ],
  },
  {
    name: "Vallée du Bandama",
    capital: "Bouaké",
    lat: 7.6906,
    lng: -5.0303,
    centers: [
      { id: "chu-bouake", name: "CHU de Bouaké", domain: "urgences", phone: "27 31 63 00 00", emergency: true },
    ],
  },
  {
    name: "Woroba",
    capital: "Séguéla",
    lat: 7.5917,
    lng: -6.6833,
    centers: [],
  },
  {
    name: "Yamoussoukro",
    capital: "Yamoussoukro",
    lat: 6.8276,
    lng: -5.2893,
    centers: [
      { id: "chr-yakro", name: "CHR de Yamoussoukro", domain: "urgences", phone: "27 30 64 00 00", emergency: true },
    ],
  },
  {
    name: "Zanzan",
    capital: "Bondoukou",
    lat: 8.0389,
    lng: -2.7864,
    centers: [],
  },
  {
    name: "Indénié-Djuablin",
    capital: "Abengourou",
    lat: 6.7167,
    lng: -3.4,
    centers: [],
  },
];

export async function GET() {
  return NextResponse.json({
    regions: REGIONS,
    count: REGIONS.length,
    totalCenters: REGIONS.reduce((sum, r) => sum + r.centers.length, 0),
    emergencyNumbers: {
      samu: "185",
      ecoutePsy: "143",
      police: "110",
    },
  });
}
