# Changelog — Sankofa

Toutes les versions notables de Sankofa sont documentées ici.
Le format est inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/spec/v2.0.0.html).

---

## [V4.1.0] — 2026-08-19 — "Culture & Traditions"

### 🌍 Added — Compétences culturelles, religieuses & traditionnelles
- **Module `cultural-context.ts`** : 7 sections (langues locales, calendrier culturel, plantes médicinales, symboles Adinkra, traditions, contextes religieux, helpers)
- **15 expressions locales** : Nouchi (yako, drap, poto, enjailler, were), Dioula (i ni ce, i ka kɛnɛ), Baoulé (kpatou, e yace, m'afiɛ), FR-CI
- **8 événements culturels CI** : Ramadan, Tabaski, Noël, rentrée scolaire, examens BEPC/BAC, saison des pluies, Fête Indépendance, Poro Sénoufo
- **5 plantes médicinales validées** : Neem, Moringa, Kinkeliba, Gingembre, Baobab (avec bénéfices + précautions + disclaimer)
- **7 symboles Adinkra enrichis** : Sankofa, Gye Nyame, Aya, Osram, Dwennimmen, Nsoromma, Sepro (avec sagesses + contexte santé)
- **6 traditions** : allaitement, port bébé, massage (bénéfiques) + scarifications, potions (à encadrer) + MGF, mariage forcé (dangereuses)
- **3 contextes religieux** : Islam, Christianisme, Religions traditionnelles (approche Sankofa)

### 📚 Added — 2 nouveaux protocoles (11 → 13)
- **Plantes médicinales CI** : Neem, Moringa, Kinkeliba, Gingembre, Baobab (info éducative, PAS de prescription)
- **Contexte religieux & santé** : Ramadan, prières, guérison par la foi, religions traditionnelles (respect sans prêche)

### 🧠 Changed — System prompt enrichi
- `buildCulturalContext()` injecté dans le system prompt
- Sankofa reconnaît les expressions locales (yako, i ni ce, kpatou)
- Conseils adaptés au calendrier culturel (Ramadan → hydratation)
- Position religieuse neutre : "Ta foi te soutient, mais vois un médecin"

### 🔒 Security
- **Plantes médicinales** : disclaimer systématique "ne remplace pas un traitement"
- **Religion** : jamais "prie et ça guérira" (danger) + jamais "la prière ne sert à rien" (respect)
- **Traditions dangereuses** : MGF + mariage forcé déjà en red flags

### 🐛 Fixed
- Bug communication (fallback systématique) corrigé : fallback sur generateChatResponse non-streaming si stream natif échoue
- Splash screen : init à true (s'affiche au premier render) + localStorage TTL 30min + durée 2.2s

---

## [V4.0.0] — 2026-08-19 — "Premium & Human"

### 🎨 Added — Beauté & Premium
- **Glassmorphism** : bulles chat (assistant + user) avec backdrop-blur + bord doré
- **Mesh gradient animé** : onboarding cinématique (5-blob drift 18s)
- **Ember particles** : 10 particules dorées flottantes avec glow
- **Logo glow** : halo pulsant derrière le SankofaLogo
- **Warm aura background** : radial-gradient `FEF9E7 → FBF3E4 → F5E6C8`
- **Avatar ring premium** : anneau dégradé gold→terracotta (online status)
- **Noise texture** : anti-plastique sur boutons (3% overlay)
- **Ripple effect** : ondées colorées au tap sur bulles
- **Staggered message entrance** : slide-up + fade-in (delay index*0.05)
- **Send button flip** : rotation 360° au succès
- **Tab content fade** : transition smooth 300ms

### 🧠 Added — Humanité & Pré-diagnostic
- **Vulnérabilité contrôlée** : "Je ne sais pas tout, mais on va trouver ensemble"
- **Humour bienveillant contextuel** (non grave uniquement)
- **Adages africains** : 7 proverbes Akan/Baoulé par domaine
- **Récits anonymes éducatifs** : "Tu n'es pas seul·e"
- **Réactions émotionnelles nuancées** : colère, honte, inquiétude
- **Pré-diagnostic adaptatif** : 10 patterns × 10 champs (causes/conséquences/facteurs/alertes/prévention)
- **3 niveaux de sévérité** : INFO / ORIENTATION / URGENCE
- **Contexte jeunesse CI** : 30+ réalités (école, argent, famille, social, santé, culture)

### 🚨 Added — Sécurité étendue
- **2 nouveaux red flags** : harcèlement scolaire + cyberharcèlement (12 total)
- **Badge "Pas un diagnostic"** dans TransparencyPanel
- **Bouton "Voir un médecin"** proéminent

### 📚 Added — Éducatif
- **2 nouveaux protocoles** : puberté + vaccination (11 total)
- **Protocole sommeil + hygiène de vie** (techniques 4-7-8, 5-4-3-2-1)
- **Orientation professionnelle santé** : 8 carrières CI (médecin, infirmier, sage-femme, etc.)
- **Quiz gamifié enrichi** : 25 questions × 5 domaines

### 🔧 Changed — Workflow conversation-first
- **Sankofa converse AVANT d'orienter** (pas d'orientation systématique)
- **Fallback response** : invite à converser au lieu de rediriger
- **8 domaines santé** (était 5) : + puberté, vaccination, orientation pro

### 🔒 Security
- **CSP corrigée** : meet.jit.si + wss://*.jitsi.meet (téléconsultation)
- **Permissions-Policy** : microphone, camera, geolocation (self)
- **X-Frame-Options** : SAMEORIGIN (Jitsi iframe)
- **Logo SVG** reconstruit (24 triangles Adinkra précalculés)
- **Icônes PWA régénérées** : fond crème + gradient doré (192 + 512)

### 🐛 Fixed
- Navigation responsive : `md:` → `lg:` (sidebar desktop ≥1024px uniquement)
- Zone de saisie fixe (`sticky bottom-0 z-20`)
- Onglet SOS 72h : overflow-x-hidden (anti-décalage TpeClock3D)
- Images coach tab : fallback gradient si erreur de chargement
- Logo onboarding : centré vertical (plus d'espace vide)

---

## [V3.0.0] — 2026-08-18 — "Innovation & Intelligence"

### 🚀 Added — Features innovantes
- **Streaming LLM** : réponses token par token (SSE, UX WhatsApp)
- **IA Sentinelle préventive** : Sankofa INITIE la conversation (proactive)
- **Calendrier menstruel chiffré** : prédictions règles/ovulation/fertile + alerte retard
- **Témoignages anonymes modérés** : pair-aidant (5 domaines + hearts)
- **Feedback boucle** : 👍/👎 sur chaque réponse + persistance DB
- **Détection émotionnelle** : 6 émotions (détresse, anxieux, triste, colère, honte)
- **Transparence IA** : panneau "Pourquoi cette réponse ?"
- **Persona auto-recommandé** : switch intelligent selon contexte
- **Audio ASR/TTS** : bouton micro + bouton écouter (3 voix persona)
- **Quiz gamifié quotidien** : 25 questions + streaks

### 📦 Added — APIs (24 → 42 routes)
- `/api/chat/stream` (SSE streaming)
- `/api/chat/transcribe` (ASR)
- `/api/chat/speak` (TTS avec phonétique)
- `/api/chat/feedback` (👍/👎)
- `/api/chat/suggestions` (adaptatives par heure)
- `/api/teleconsultation/book` (Jitsi + médecin)
- `/api/analytics/track` (17 événements)
- `/api/carnet/sync` + `/api/cycle/sync` (cloud chiffré)
- `/api/tpe/centers` (8 centres CI géolocalisés)
- `/api/reminders` (CRUD complet)
- `/api/quiz/today` + `/api/quiz/stats`
- `/api/testimonies` + modération + hearts
- `/api/sentinel/check` + `/api/sentinel/status`
- `/api/user/me` + `/api/user/delete` + `/api/user/export` (RGPD)
- `/api/health/alerts` + `/api/health/regions`
- `/api/admin/users` + `/api/admin/feedback`
- `/api/protocols/search` + `/api/protocols/[slug]`

### 🗄️ Added — Modèles Prisma
- CarnetSync, CycleSync, Reminder, Feedback, Teleconsultation, Testimony, TestimonyHeart, AnalyticsEvent, HealthAlert (16 modèles total)

### 🎨 Changed — Visual polish
- Logo V3 : 24 triangles Adinkra + oiseau détaillé + œuf texturé
- Palette alignée persona Aya (VLM-analyzed)
- Bottom-nav auto-hide Instagram (mobile only, after user interaction)
- Sidebar desktop (≥768px → ≥1024px en V4)

---

## [V2.0.0] — 2026-08-17 — "Fondations"

### 🚀 Added — MVP complet
- **5 tabs** : Parler (chat), Conseils (coach), SOS 72h (TPE), Carnet (chiffré), Aide
- **3 personas** : Aya (grande sœur), Yao (grand frère), Tonton Koffi (médecin)
- **Registre adaptatif** : Nouchi / Standard / Familier / Soutenu / Sober
- **10 red flags** : suicide, viol, overdose, addiction, MGF, etc.
- **9 protocoles RAG** : IST, TPE, contraception, addictologie, dermatologie, psy, nutrition, VBG
- **Mode compagnon de trajet** : check-ins périodiques (55 messages pré-écrits)
- **Carnet chiffré AES-256** : IndexedDB + Web Crypto + PIN
- **PWA offline** : service worker (cache-first + chat SWR + background sync)
- **Auth OTP téléphone** : SHA-256 hash + NextAuth JWT (30 jours)
- **Paiement Mobile Money** : Wave + Orange + MTN (CinetPay integration)
- **Admin dashboard** : conversations + stats

### 🎨 Added — Design
- Palette "Terre Brûlée & Couchée de Soleil" (11 variables CSS)
- Logo Sankofa (oiseau Adinkra + œuf)
- Framer Motion animations
- shadcn/ui (New York style) + Lucide icons
- Tailwind CSS 4

### 🔒 Added — Sécurité
- Post-check safety : 5 patterns regex (bloque dosages, diagnostics, avortement)
- Guardrails médicaux (Décret 2018-361 + loi CI)
- Anonymat radical (UUID local par défaut)

---

## [V1.0.0] — 2026-08-14 — "Genesis"

### 🚀 Added — Initialisation
- Next.js 16 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui
- Prisma ORM (SQLite) + z-ai-web-dev-sdk
- Structure app shell (5 tabs placeholder)
- Premier chat IA basique (LLM z-ai)
- Layout mobile-first responsive
- Configurations de base (eslint, tsconfig, postcss, Caddyfile)

---

## Roadmap — Évolutions futures

### [V5.0.0] — Q1 2027 — "Voice & Connection"
- 🎙️ **Audio multilingue natif** : ASR/TTS voix ivoiriennes (Dioula/Baoulé/FR/Nouchi)
- 🤝 **Mode pair-aidant réel** : chat anonyme entre jeunes (modéré)
- 📊 **Analytics dashboard public** : santé jeunes CI agrégée
- 🔔 **Rappels push intelligents** : TPE J+7, pilule, dépistage annuel
- 🌍 **Carte TPE interactive** : géolocalisation temps réel + horaires

### [V6.0.0] — Q2 2027 — "Teleconsultation réelle"
- 🩺 **Visio médecin intégrée** : Jitsi + partenaires AIBEF
- 💊 **Ordonnance numérique** : si médecin partenaire (légal CI)
- 📋 **Dossier médical partagé** : carnet chiffré + médecin (opt-in)
- 💳 **Assurance santé micro-paiement** : 100 F/jour
- 🏥 **Réseau centres certifiés** : API partenaires

### [V7.0.0] — Q3 2027 — "AI Sentinelle Avancée"
- 🧠 **IA prédictive** : détection précoce dépression/anxiété (ML local)
- 📈 **Journal d'humeur chiffré** : graphiques 7/30/90 jours
- 🎯 **Exercices d'auto-apaisement guidés** : respiration, ancrage, méditation
- 🔄 **Reformulation cognitive douce** : pensées négatives → alternatives
- 📚 **Bibliothèque ressources psy** : articles, vidéos, podcasts CI

### [V8.0.0] — Q4 2027 — "Scale & Impact"
- 🌐 **Multi-pays africains** : adaptation Sénégal, Mali, Burkina, Guinée
- 🏛️ **Partenariat Ministère Santé CI** : intégration programme national
- 📊 **Dashboard santé publique** : alertes épidémies, tendances
- 🔬 **Recherche académique** : études sur impact santé jeunes CI
- 💰 **Modèle économique B2B** : cliniques privées + entreprises

---

## Conventions de version

- **V1.x.x** : corrections de bugs mineurs
- **Vx.1.0** : nouvelles fonctionnalités (backward compatible)
- **Vx.0.0** : changements majeurs (breaking changes possibles)

---

## Liens utiles

- **Repository** : https://github.com/sankofa/sankofa-app
- **Documentation** : `/worklog.md` (historique complet des développements)
- **Roadmap détaillée** : ce fichier, section "Roadmap"
- **Conformité** : Décret 2018-361 (télémédecine CI), Loi 98-757 (MGF), Loi 2015 (dépigmentation), GDPR/ARTCI

---

*Sankofa — Ton aîné·e santé. Façonnée en Côte d'Ivoire. 🇨🇮🌿*
