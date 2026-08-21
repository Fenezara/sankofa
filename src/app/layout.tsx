import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { InstallButton } from "@/components/pwa/install-button";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SplashScreen } from "@/components/aya/splash-screen";

export const metadata: Metadata = {
  title: "Sankofa — Ton aîné·e santé. 100% anonyme, 24/7. Façonnée en Côte d'Ivoire.",
  description:
    "Sankofa — coach santé IA validé par des médecins ivoiriens. 100% anonyme, 24/7. 5 domaines: SSR, addictologie, dermatologie, santé mentale, nutrition. 2 langues écrites (français, Nouchi) — Dioula et Baoulé en audio bientôt. Conforme au Décret 2018-361.",
  keywords: [
    "Sankofa",
    "santé sexuelle",
    "santé reproductive",
    "Côte d'Ivoire",
    "TPE 72h",
    "IST",
    "contraception",
    "AIBEF",
    "jeunes ivoiriens",
    "Nouchi",
    "télémédecine",
    "Abidjan",
    "Yopougon",
  ],
  authors: [{ name: "Sankofa — Côte d'Ivoire" }],
  applicationName: "Sankofa",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Sankofa — Ton aîné·e santé",
    description:
      "Coach santé IA validé par des médecins ivoiriens. 100% anonyme, 24/7. SSR, addictologie, dermatologie, santé mentale, nutrition. En français et Nouchi (Dioula et Baoulé en audio bientôt).",
    siteName: "Sankofa",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sankofa — Ton aîné·e santé",
    description:
      "Coach santé IA validé — anonyme, 24/7, en français et Nouchi (Dioula et Baoulé en audio bientôt). Façonnée en Côte d'Ivoire.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sankofa",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#D65430",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground font-sans"
      >
        <AuthProvider>
          <RegisterSW />
          <OfflineBanner />
          <SplashScreen>{children}</SplashScreen>
          <InstallButton />
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
