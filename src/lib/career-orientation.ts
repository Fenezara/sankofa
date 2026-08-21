/**
 * Sankofa — Orientation professionnelle santé (V4)
 *
 * Guide les jeunes ivoiriens vers les carrières de santé accessibles en CI.
 * Répond à "je veux être médecin/infirmier/sage-femme" avec des infos concrètes :
 * - Établissements de formation
 * - Conditions d'admission
 * - Durée des études
 * - Coûts
 * - Débouchés
 *
 * Pas de conseil médical — juste de l'orientation professionnelle.
 */

export interface CareerPath {
  id: string;
  title: string;
  category: "medical" | "paramedical" | "public-health" | "support";
  duration: string;
  level: string; // niveau d'étude requis
  institutions: string[];
  admission: string;
  costs: string;
  jobDescription: string;
  jobOpportunities: string[];
  salaryRange: string;
  personalityFit: string[];
}

export const HEALTH_CAREERS: CareerPath[] = [
  {
    id: "medecin",
    title: "Médecin",
    category: "medical",
    duration: "7-10 ans (bac + 7 à +10)",
    level: "Bac scientifique (série D)",
    institutions: [
      "Université Félix Houphouët-Boigny (Cocody) — Faculté de Médecine",
      "Université Alassane Ouattara (Bouaké) — Faculté de Médecine",
      "Université Lorogne de Khorogo — Faculté de Médecine",
    ],
    admission: "Concours d'entrée après Bac D (très sélectif, quota)",
    costs: "Inscription université publique ~50 000 F/an + frais de vie",
    jobDescription: "Diagnostique, soigne, prévient les maladies. Peut se spécialiser (chirurgie, pédiatrie, gynéco, psychiatrie, etc.).",
    jobOpportunities: ["CHU publics", "Cliniques privées", "ONG", "Ministère Santé", "Libéral"],
    salaryRange: "Débutant : 400 000-800 000 F/mois (public). Privé/libéral : 1-5 millions+",
    personalityFit: ["Rigueur scientifique", "Empathie", "Résistance au stress", "Patience", "Esprit d'analyse"],
  },
  {
    id: "infirmier",
    title: "Infirmier·ère diplômé·e d'État (IDE)",
    category: "paramedical",
    duration: "3 ans (bac + 3)",
    level: "Bac (toutes séries, scientifique préférée)",
    institutions: [
      "École Nationale de Santé Publique (ENSP) — Abidjan",
      "Institut National de Formation des Agents de Santé (INFAS) — Bouaké",
      "Écoles privées agréées (Institut Saint-Jean, etc.)",
    ],
    admission: "Concours d'entrée après Bac (dossier + écrit)",
    costs: "Public : ~100 000 F/an. Privé : 500 000-1 500 000 F/an",
    jobDescription: "Soigne les patients au quotidien, administre les traitements, éduque à la santé, accompagne les familles.",
    jobOpportunities: ["CHU publics", "Centres de santé", "Cliniques privées", "ONG", "Entreprises", "Libéral"],
    salaryRange: "Débutant : 200 000-400 000 F/mois. Évolution : 400 000-800 000+",
    personalityFit: ["Empathie", "Patience", "Rigueur", "Disponibilité", "Travail en équipe"],
  },
  {
    id: "sage-femme",
    title: "Sage-femme (Maïeuticienne)",
    category: "paramedical",
    duration: "3 ans (bac + 3)",
    level: "Bac scientifique (série D ou D')",
    institutions: [
      "École Nationale de Santé Publique (ENSP) — Abidjan",
      "INFAS — Bouaké",
      "Écoles privées agréées",
    ],
    admission: "Concours d'entrée après Bac D (souvent réservé filles, quota)",
    costs: "Public : ~100 000 F/an. Privé : 500 000-1 500 000 F/an",
    jobDescription: "Suit les grossesses, assiste les accouchements, assure les soins prénataux et postnataux, conseille en planning familial.",
    jobOpportunities: ["Maternités publiques", "Centres de santé", "Cliniques privées", "ONG", "Libéral"],
    salaryRange: "Débutant : 200 000-350 000 F/mois. Évolution : 350 000-600 000+",
    personalityFit: ["Empathie", "Calme", "Réactivité", "Forte résistance", "Sens des responsabilités"],
  },
  {
    id: "pharmacien",
    title: "Pharmacien·ne",
    category: "medical",
    duration: "6 ans (bac + 6)",
    level: "Bac scientifique (série D)",
    institutions: [
      "Université Félix Houphouët-Boigny — Faculté de Pharmacie",
    ],
    admission: "Concours d'entrée après Bac D (très sélectif)",
    costs: "Inscription publique ~50 000 F/an + frais de vie",
    jobDescription: "Dispense les médicaments, conseille les patients, contrôle les prescriptions, peut ouvrir sa pharmacie.",
    jobOpportunities: ["Officine (pharmacie)", "Hôpitaux", "Industrie pharmaceutique", "Importation/distribution", "Libéral"],
    salaryRange: "Débutant : 500 000-1 000 000 F/mois. Pharmacien titulaire : 2-10 millions+",
    personalityFit: ["Rigueur scientifique", "Sens commercial", "Conseil", "Précision", "Disponibilité"],
  },
  {
    id: "psychologue",
    title: "Psychologue clinicien·ne",
    category: "paramedical",
    duration: "5 ans (bac + 5)",
    level: "Bac (toutes séries)",
    institutions: [
      "Université Félix Houphouët-Boigny — Département de Psychologie",
      "Université Alassane Ouattara (Bouaké)",
    ],
    admission: "Inscription directe après Bac (pas de concours mais sélection sur dossier)",
    costs: "Inscription publique ~50 000 F/an",
    jobDescription: "Évalue et accompagne les difficultés psychologiques, psychothérapie, soutien aux patients et familles.",
    jobOpportunities: ["CHU", "Cabinets privés", "ONG", "Écoles", "Entreprises", "EHPAD"],
    salaryRange: "Débutant : 250 000-500 000 F/mois. Expérimenté : 500 000-2 millions+",
    personalityFit: ["Écoute", "Empathie", "Discrétion", "Esprit d'analyse", "Patience infinie"],
  },
  {
    id: "aides-soignant",
    title: "Aide-soignant·e",
    category: "paramedical",
    duration: "1-2 ans",
    level: "Brevet d'études du premier cycle (BEPC) minimum",
    institutions: [
      "INFAS — Bouaké",
      "Écoles privées agréées",
    ],
    admission: "Concours d'entrée après BEPC",
    costs: "Public : ~50 000 F/an. Privé : 300 000-800 000 F/an",
    jobDescription: "Assiste les infirmier·ères dans les soins de base, aide à l'hygiène, accompagne le patient au quotidien.",
    jobOpportunities: ["CHU publics", "Centres de santé", "Cliniques privées", "EHPAD", "Soins à domicile"],
    salaryRange: "Débutant : 120 000-200 000 F/mois. Évolution : 200 000-300 000+",
    personalityFit: ["Empathie", "Patience", "Disponibilité", "Sens de l'hygiène", "Force physique"],
  },
  {
    id: "technicien-labo",
    title: "Technicien·ne de laboratoire médical",
    category: "paramedical",
    duration: "2-3 ans",
    level: "Bac scientifique (D)",
    institutions: [
      "ENSP — Abidjan",
      "INFAS — Bouaké",
      "Écoles privées",
    ],
    admission: "Concours après Bac D",
    costs: "Public : ~80 000 F/an. Privé : 500 000-1 200 000 F/an",
    jobDescription: "Réalise les analyses médicales (sang, urine, prélèvements), aide au diagnostic.",
    jobOpportunities: ["Laboratoires d'analyses", "Hôpitaux", "Cliniques", "Recherche", "Libéral"],
    salaryRange: "Débutant : 200 000-350 000 F/mois. Évolution : 350 000-600 000+",
    personalityFit: ["Rigueur", "Précision", "Esprit scientifique", "Patience", "Sens de l'hygiène"],
  },
  {
    id: "sante-publique",
    title: "Spécialiste en santé publique",
    category: "public-health",
    duration: "Bac + 5 à +8 (médecine + spécialisation)",
    level: "Médecine générale + Master Santé Publique",
    institutions: [
      "Université Félix Houphouët-Boigny — Institut National de Santé Publique (INSP)",
      "INHP — Abidjan",
    ],
    admission: "Médecine générale validée + concours Master",
    costs: "Inscription publique ~100 000 F/an",
    jobDescription: "Conçoit et pilote les politiques de santé publique, prévention, épidémiologie, gestion de programmes.",
    jobOpportunities: ["Ministère de la Santé", "OMS", "UNICEF", "ONG", "Programmes nationaux", "Recherche"],
    salaryRange: "Débutant : 600 000-1 200 000 F/mois. International : 2-5 millions+",
    personalityFit: ["Vision stratégique", "Esprit d'analyse", "Leadership", "Communication", "Rigueur"],
  },
];

/**
 * Catégories de carrières pour l'affichage.
 */
export const CAREER_CATEGORIES = [
  { id: "medical", label: "Médical", emoji: "🩺", desc: "Médecins, pharmaciens" },
  { id: "paramedical", label: "Paramédical", emoji: "💉", desc: "Infirmiers, sages-femmes, labo" },
  { id: "public-health", label: "Santé publique", emoji: "🌍", desc: "Politiques, programmes, épidémio" },
  { id: "support", label: "Support", emoji: "🤝", desc: "Aides-soignants, accueil" },
] as const;

/**
 * Retrouve une carrière par ID.
 */
export function getCareerById(id: string): CareerPath | undefined {
  return HEALTH_CAREERS.find((c) => c.id === id);
}

/**
 * Filtre les carrières par catégorie.
 */
export function getCareersByCategory(category: string): CareerPath[] {
  return HEALTH_CAREERS.filter((c) => c.category === category);
}

/**
 * Recommande des carrières selon la personnalité.
 */
export function recommendCareers(traits: string[]): CareerPath[] {
  return HEALTH_CAREERS.filter((c) =>
    c.personalityFit.some((t) => traits.includes(t.toLowerCase())),
  );
}
