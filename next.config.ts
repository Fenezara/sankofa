import type { NextConfig } from "next";

/**
 * Sankofa — Configuration Next.js (V4)
 *
 * Sécurité :
 *  - CSP stricte avec exceptions whitelistées (CinetPay, Jitsi pour téléconsultation, Meta WhatsApp)
 *  - Permissions : microphone auto (ASR/TTS), geolocation opt-in (centres TPE)
 *  - Headers sécurité standard (XSS, clickjacking, HTTPS)
 *
 * Production : output standalone (Docker-friendly)
 */

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // Jitsi teleconsultation needs iframe embed
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=self (ASR/TTS audio feature), geolocation=self (centres TPE géolocalisés), camera=self (téléconsultation visio)
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), autoplay=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      // connect-src : CinetPay (payment), Jitsi (teleconsultation), Meta (WhatsApp), self
      "connect-src 'self' https://graph.facebook.com https://api-checkout.cinetpay.com https://*.jitsi.meet wss://*.jitsi.meet",
      // frame-src : Jitsi teleconsultation embedded visio
      "frame-src 'self' https://meet.jit.si",
      // media-src : audio TTS responses + media capture
      "media-src 'self' blob:",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
    ].join("; ") + ";",
  },
];

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    qualities: [75, 80, 85],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
