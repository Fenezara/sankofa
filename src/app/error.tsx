"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Sankofa error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-creme-baobab text-terre-brulee p-6 text-center">
      <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-bricolage)" }}>
        Oups, quelque chose s'est mal passé
      </h2>
      <p className="text-sm text-terre-brulee/60 mb-6 max-w-md">
        Sankofa a rencontré une erreur. Ce n'est pas ta faute. Recharge la page ou réessaie dans un instant.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-terracotta text-creme-baobab font-bold text-sm hover:bg-ocre-rouge transition-colors"
      >
        <RefreshCw className="size-4" />
        Recharger
      </button>
      <p className="mt-6 text-xs text-terre-brulee/40">
        Si le problème persiste : contact@sankofa.ci
      </p>
    </div>
  );
}
