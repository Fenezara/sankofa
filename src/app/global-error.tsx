"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Sankofa global error]", error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: "2rem", fontFamily: "system-ui, sans-serif", background: "#FFF9F0", color: "#4A1C0E", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>
          Sankofa a rencontré une erreur critique
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#7A4530", marginBottom: "1.5rem", maxWidth: "400px" }}>
          L'application n'a pas pu se charger correctement. Recharge la page.
        </p>
        <button
          onClick={reset}
          style={{ padding: "0.75rem 1.5rem", borderRadius: "9999px", backgroundColor: "#D65430", color: "#FFF9F0", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem" }}
        >
          Recharger
        </button>
      </body>
    </html>
  );
}
