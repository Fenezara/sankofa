"use client";

import * as React from "react";
import { Leaf, Sparkles, Languages } from "lucide-react";
import {
  MEDICINAL_PLANTS,
  ADINKRA_SYMBOLS,
  LOCAL_EXPRESSIONS,
} from "@/lib/cultural-context";

/**
 * Sankofa — Section culturelle (Coach tab)
 *
 * Rend VISIBLES les compétences culturelles : plantes médicinales, symboles Adinkra,
 * expressions locales. Affichée dans l'onglet Conseils.
 */
export function CulturalSection() {
  const [activeTab, setActiveTab] = React.useState<"plants" | "adinkra" | "expressions">("plants");

  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
        Sagesse africaine
      </h3>

      {/* Onglets internes */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setActiveTab("plants")}
          className={`press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "plants"
              ? "bg-vert-baobab/15 border border-vert-baobab/30 text-vert-baobab"
              : "bg-creme-baobab border border-ocre-rouge/10 text-ocre-rouge/60"
          }`}
        >
          <Leaf className="size-3.5" />
          Plantes
        </button>
        <button
          onClick={() => setActiveTab("adinkra")}
          className={`press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "adinkra"
              ? "bg-terracotta/15 border border-terracotta/30 text-terracotta"
              : "bg-creme-baobab border border-ocre-rouge/10 text-ocre-rouge/60"
          }`}
        >
          <Sparkles className="size-3.5" />
          Adinkra
        </button>
        <button
          onClick={() => setActiveTab("expressions")}
          className={`press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === "expressions"
              ? "bg-ambre-couchant/15 border border-ambre-couchant/30 text-ambre-couchant"
              : "bg-creme-baobab border border-ocre-rouge/10 text-ocre-rouge/60"
          }`}
        >
          <Languages className="size-3.5" />
          Langues
        </button>
      </div>

      {/* Contenu */}
      <div className="sankofa-card rounded-2xl p-4">
        {activeTab === "plants" && (
          <div className="space-y-3">
            {MEDICINAL_PLANTS.map((plant) => (
              <div key={plant.id} className="border-b border-ocre-rouge/10 last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🌿</span>
                  <p className="text-sm font-bold text-terre-brulee">{plant.name}</p>
                  <span className="text-[10px] italic text-ocre-rouge/50">{plant.scientificName}</span>
                </div>
                <p className="text-[11px] text-ocre-rouge/70 leading-snug">
                  <span className="font-semibold">Bienfaits :</span> {plant.validatedBenefits.join(", ")}
                </p>
                <p className="text-[10px] text-terracotta/80 mt-1 italic">
                  ⚠️ {plant.disclaimer}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "adinkra" && (
          <div className="space-y-3">
            {ADINKRA_SYMBOLS.map((symbol) => (
              <div key={symbol.name} className="border-b border-ocre-rouge/10 last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🔮</span>
                  <p className="text-sm font-bold text-terre-brulee">{symbol.name}</p>
                  <span className="text-[10px] text-ocre-rouge/60">— {symbol.meaning}</span>
                </div>
                <p className="text-[11px] text-ocre-rouge/80 italic leading-snug">
                  "{symbol.wisdom}"
                </p>
                <p className="text-[10px] text-vert-baobab/80 mt-0.5">
                  💚 {symbol.healthContext}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "expressions" && (
          <div className="space-y-2">
            {LOCAL_EXPRESSIONS.map((expr) => (
              <div key={expr.expression} className="flex items-center justify-between py-1.5 border-b border-ocre-rouge/10 last:border-0">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-terre-brulee">"{expr.expression}"</span>
                  <span className="text-[10px] text-ocre-rouge/60">{expr.meaning}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-ocre-rouge/10 text-ocre-rouge/70">
                  {expr.language}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
