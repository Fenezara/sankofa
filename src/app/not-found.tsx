import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-creme-baobab text-terre-brulee p-6 text-center">
      <h1 className="text-6xl font-black mb-4" style={{ fontFamily: "var(--font-bricolage)" }}>
        404
      </h1>
      <p className="text-sm text-terre-brulee/60 mb-6">
        Cette page n'existe pas.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-full bg-terracotta text-creme-baobab font-bold text-sm hover:bg-ocre-rouge transition-colors"
      >
        Retour à Sankofa
      </Link>
    </div>
  );
}
