/**
 * Sankofa — Phonetic pre-processing for TTS (V4)
 *
 * Le SDK z-ai-web-dev-sdk TTS ne propose que des voix chinoises (tongtong, xiaochen,
 * luodo, etc.). Ces voix prononcent le texte français avec des règles phonétiques
 * chinoises → accent incompréhensible.
 *
 * Solution : pré-traiter le texte français via le LLM pour générer une phonétique
 * adaptée aux voix chinoises. Le LLM transforme le français en pseudo-pinyin
 * que la voix chinoise peut prononcer de manière reconnaissable.
 *
 * Exemple :
 *   "Bonjour, je suis Sankofa" → "bon-jour, je sou-i Sankofa"
 *   (approximation phonétique lisible par la voix chinoise)
 *
 * Fallback : si le LLM échoue, on renvoie le texte original (l'accent restera
 * chinois mais le texte sera quand même généré).
 *
 * Privacy-safe : aucune donnée stockée, transformation en mémoire seule.
 */

import ZAI from "z-ai-web-dev-sdk";

let zaiClient: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getClient() {
  if (zaiClient) return zaiClient;
  zaiClient = await ZAI.create();
  return zaiClient;
}

/**
 * Transforme un texte français en phonétique adaptée aux voix TTS chinoises.
 *
 * Le LLM est invité à produire une version "phonétique" du texte où :
 *  - les mots français complexes sont simplifiés en syllabes prononçables
 *  - les accents et caractères spéciaux sont normalisés
 *  - les nombres sont écrits en toutes lettres
 *  - les abréviations sont développées
 *
 * Le résultat reste du texte lisible (pas du pinyin pur), mais optimisé pour
 * la prononciation par une voix chinoise.
 */
export async function preprocessForTTS(
  text: string,
  persona: "grande_soeur" | "grand_frere" | "tonton_medecin" = "grande_soeur",
): Promise<string> {
  // Si le texte est court ou simple, on évite l'appel LLM (gain de latence)
  if (text.length < 30) {
    return simplePhoneticAdjust(text);
  }

  try {
    const zai = await getClient();

    const systemPrompt = `Tu es un expert en phonétique française adaptée aux synthèses vocales chinoises.
Ta tâche : transformer un texte français en version phonétique QUI SERA PRONONCÉE par une voix chinoise TTS.

RÈGLES :
1. Garde le texte en français (ne traduis PAS en chinois)
2. Simplifie les mots difficiles à prononcer en syllabes plus simples
3. Les "in", "ain", "ein" → "an" (ex: "matin" → "matan")
4. Les "ou" → garder "ou" (la voix chinoise le prononce bien)
5. Les "u" → "ou" (ex: "tu" → "tou") car la voix chinoise ne fait pas le "u" français
6. Les "r" finaux → garder (la voix chinoise les prononce)
7. Les "oi" → "oua" (ex: "moi" → "moua")
8. Les nombres → écris-les en lettres ("3" → "trois")
9. Les emojis → supprime-les
10. Les abréviations (IST, TPE, VIH) → garde-les telles quelles (acronymes)
11. Pas de ponctuation excessive
12. Garde le sens et le ton (empathique, médical)

EXEMPLES :
- "Bonjour, je suis Sankofa, ton aînée santé." → "Bon-jour, je sou-i Sankofa, ton aînée santé."
- "Tu n'es pas seul·e, je suis là pour toi." → "Tu n'es pas seule, je sou-i là pour toa."
- "Le TPE doit être pris dans les 72 heures." → "Le TPE doit être pris dans les soixante-douze heures."

Persona : ${persona === "grande_soeur" ? "Aya (féminin, chaleureux)" : persona === "grand_frere" ? "Yao (masculin, fraternel)" : "Tonton Koffi (masculin, médical)"}

Réponds UNIQUEMENT avec le texte phonétique transformé, sans explication.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      thinking: { type: "disabled" },
    });

    const result = completion?.choices?.[0]?.message?.content?.trim();
    if (!result || result.length === 0) {
      return simplePhoneticAdjust(text);
    }
    return result;
  } catch (err) {
    console.error("[Sankofa TTS phonetic] LLM error:", err);
    return simplePhoneticAdjust(text);
  }
}

/**
 * Ajustements phonétiques simples sans LLM (fallback rapide).
 * Applique les règles les plus courantes pour améliorer la prononciation.
 */
function simplePhoneticAdjust(text: string): string {
  let result = text;

  // Supprimer les emojis (perturbent la voix)
  result = result.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // Remplacer les caractères spéciaux
  result = result.replace(/·/g, ""); // "seul·e" → "seule"
  result = result.replace(/[«»"]/g, "");
  result = result.replace(/—/g, ",");

  // "u" isolé ou en fin de syllabe → "ou" (la voix chinoise ne fait pas le "u" français)
  // Mais pas pour "tu", "su" qui sont courts — on garde pour le contexte
  // Règle simple : "u" entre consonnes → "ou" seulement si le mot est long
  // En réalité, cette règle est trop risquée sans LLM — on la saute pour le fallback

  // "oi" → "oua" (moi → moua, toi → toua)
  result = result.replace(/\boi\b/g, "oua");
  result = result.replace(/(?<=[mtns])oi\b/gi, (m) => m.charAt(0) + "oua");

  // Les "in/ain/ein" → "an" (matin → matan)
  result = result.replace(/ain\b/gi, "an");
  result = result.replace(/ein\b/gi, "an");

  // Nombres en lettres (0-9 seulement pour le fallback simple)
  const numberWords: Record<string, string> = {
    "0": "zéro", "1": "un", "2": "deux", "3": "trois",
    "4": "quatre", "5": "cinq", "6": "six", "7": "sept",
    "8": "huit", "9": "neuf",
  };
  result = result.replace(/\b\d\b/g, (m) => numberWords[m] ?? m);

  // Nettoyer les espaces multiples
  result = result.replace(/\s+/g, " ").trim();

  return result;
}
