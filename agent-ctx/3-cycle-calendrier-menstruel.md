# Work record — Task 3-cycle (Calendrier Menstruel Chiffré)

**Agent**: subagent (3-cycle)
**Task**: Add an encrypted menstrual cycle tracker to Sankofa. Privacy is CRITICAL — cycle data is encrypted client-side (AES-256 via Web Crypto, same as the carnet). The server NEVER sees plaintext cycle data.

## Contexte lu
- Worklog lu (2350 lignes) — projet Doc Confida / Sankofa, 5 tabs (chat, coach, tpe, carnet, aide), 24+ API.
- Pattern de chiffrement du carnet (`src/lib/carnet/crypto.ts`) : AES-256-GCM + Web Crypto API.
- API route `/api/carnet/sync/route.ts` étudiée comme template pour `/api/cycle/sync`.
- `src/lib/server-auth.ts` (getAuthenticatedUserId) — wrapper getServerSession.
- `src/components/aya/carnet-section.tsx` — la section à étendre.

## Fichiers créés / modifiés

### CREATED: `prisma/schema.prisma` (+35 lignes)
- Model `CycleSync` ajouté (id, userId unique, encryptedBlob base64, iv base64, version, cycleCount, updatedAt, createdAt).
- Relation `cycleSync CycleSync?` ajoutée au modèle `User`.
- Index `@@index([userId])`.
- `bun run db:push` → schema synced, Prisma Client regenerated.

### CREATED: `src/lib/cycle.ts` (~270 lignes, 0 dépendance externe)
Bibliothèque PURE de prédictions menstruelles :
- Types : `Flow`, `CycleSymptom`, `CycleEntry`.
- Constantes : `CYCLE_SYMPTOMS` (6 symptômes), `SYMPTOM_LABELS`, `FLOW_LABELS`, `DEFAULT_CYCLE_LENGTH=28`, `LUTEAL_PHASE_LENGTH=14`, `FERTILE_WINDOW_BEFORE=5`, `FERTILE_WINDOW_AFTER=1`, `LATE_THRESHOLD_DAYS=5`, `MIN/MAX_NORMAL_CYCLE=21/35`.
- Helpers date UTC-safe : `parseDate`, `formatDate`, `addDays`, `diffDays`, `todayUTC`, `isDateInRange`, `getMonthGrid`, `getMonthLabel`, `WEEKDAY_LABELS`.
- `averageCycleLength(cycles)` — moyenne des intervalles filtrés (21-35j, ignore les irréguliers).
- `averagePeriodLength(cycles)` — moyenne des durées de saignement (5j par défaut).
- `predictNextPeriod(cycles, now)` → `{ nextDate, confidence }` avec score 0/0.3/0.5/0.7/0.85 selon nb cycles.
- `predictOvulation(nextPeriod)` → J-14 (phase lutéale stable).
- `predictFertileWindow(nextPeriod)` → `{ start: ovulation-5, end: ovulation+1, ovulation }` (7 jours).
- `isLate(cycles, now)` → `{ late, daysLate }` (jamais late si 0 cycle).
- Helpers UI : `formatHumanDate` (12 mars), `formatRelativeDays` (dans X jours / aujourd'hui / hier).

### CREATED: `src/app/api/cycle/sync/route.ts` (~150 lignes)
- `export const runtime = "nodejs"`.
- `GET` → renvoie `{ cycle: { encryptedBlob, iv, version, cycleCount, updatedAt } | null }`. Auth requise.
- `POST` body `{ encryptedBlob, iv, cycleCount, version? }` → upsert dans `CycleSync`. Limite 2 MB (cycle léger). Auth requise.
- Conflit : LWW côté client (serveur ne fait que stocker le blob).
- Privacy : serveur ne peut JAMAIS déchiffrer (blob AES-256-GCM + IV base64).

### CREATED: `src/components/aya/cycle-section.tsx` (~640 lignes)
Section React client-side avec :

**Chiffrement transparent** :
- `getOrCreateDeviceKey()` — génère 32 octets aléatoires (base64) au 1er usage, stocké dans `localStorage["sankofa:cycle-key-material"]`, importé comme `CryptoKey` AES-256-GCM non-extractible.
- `encryptCycles(cycles, key)` → `{ iv, ciphertext, cycleCount, version, updatedAt }` (IV aléatoire 12 octets par opération).
- `decryptCycles(blob, key)` → `CycleEntry[]`.
- `loadBlobFromLS` / `saveBlobToLS` via `localStorage["sankofa:cycle-blob"]`.

**Chargement au mount** (useEffect) :
1. Init clé device.
2. Charge blob localStorage.
3. Si authentifié·e, `fetch("/api/cycle/sync")` → si updatedAt cloud > local, prend le cloud (LWW).
4. Déchiffre → cycles.
5. Hydration-safe : `now`, `viewYear`, `viewMonth` init à 0/null côté SSR, settés dans useEffect. Placeholder skeleton pendant chargement.

**UI** :
- En-tête avec icône CalendarDays + badge "Chiffré AES-256 · Sync cloud / 100% local" + bouton "Marquer mes règles".
- Alerte retard si `late.daysLate > 5` → bannière terracotta "Test de grossesse recommandé" (~500-1500 FCFA, fiable dès J+1).
- Grille 3 cartes prédictions : prochaines règles (terracotta), ovulation (vert-baobab), fenêtre fertile (ambre-couchant).
- Légende (4 entrées avec pastilles colorées).
- Navigation mois (prev/next + "Revenir à aujourd'hui").
- Grille calendrier 7×6 (D L M M J V S) — chaque cellule :
  · point terracotta #B5684A si jour de règles (ou endDate +/-)
  · fond ambre-couchant/15 si fenêtre fertile prédite
  · point vert-baobab #2D4A2D si ovulation prédite
  · contour ocre-rouge + ring si aujourd'hui
- Liste scrollable des cycles enregistrés (`max-h-32 overflow-y-auto aya-scroll`), tri décroissant, bouton supprimer au hover.
- Footer sync status : "Sync cloud prêt" / "Local uniquement · connecte-toi pour sync cloud".

**Dialog "Marquer mes règles"** (Dialog shadcn) :
- `<input type="date">` début (max today, requis).
- `<input type="date">` fin (min début, optionnel).
- Sélecteur flux 3 boutons (léger/moyen/abondant) avec pastille couleur + aria-pressed.
- Multi-select symptômes (6 boutons toggle, 2 colonnes).
- Notes textarea (optionnel).
- Bouton Enregistrer → ajoute CycleEntry (remplace si même startDate), persiste + sync.

**Couleurs (palette Sankofa)** :
- Règles : #B5684A (rose-couchée / terracotta doux) — conforme au brief.
- Ovulation : #2D4A2D (vert-baobab).
- Fenêtre fertile : ambre-couchant (#8B5A14) en bg léger 15%.
- Aujourd'hui : contour ocre-rouge (#7A2E12).
- Zéro indigo/bleu.

### MODIFIED: `src/components/aya/carnet-section.tsx`
- Import `CycleSection` depuis `@/components/aya/cycle-section`.
- `<CycleSection />` rendu sous la section "Sync cloud" (avant la note privacy finale).
- Reste du CarnetSection intact (header, sécurité, CTA, types, features, sync cloud).

## Décisions techniques

1. **Clé device vs PIN utilisateur** : contrairement au carnet (PIN utilisateur), le cycle utilise une clé device aléatoire persistée en localStorage. Justification :
   - UX : pas de friction PIN pour accéder au calendrier (c'est "in-tab", pas un modal séparé).
   - Privacy : blob chiffré AES-256-GCM, clé ne JAMAIS quitte le device, serveur ne voit jamais plaintext.
   - Sync cloud : blob chiffré stocké côté serveur, inutilisable sans clé device. Cross-device impliquerait de redériver la clé via PIN (futur : réutiliser carnet PIN pour débloquer cycle cross-device).
   - Conséquence : si l'utilisateur wipe localStorage, il perd l'accès (comme pour le carnet sans PIN).

2. **Pas de lib externe calendrier** : grille HTML/CSS native (`getMonthGrid` retourne 42 cellules avec null pour les jours hors mois). Aucune dépendance ajoutée.

3. **IV aléatoire par opération** : `crypto.getRandomValues(new Uint8Array(12))` à chaque encrypt — conforme aux best practices AES-GCM (jamais réutiliser un IV avec la même clé).

4. **LWW côté client** : au mount, si cloud updatedAt > local → on prend cloud. Sinon on garde local. Le serveur ne merge pas (il ne fait que stocker le blob).

5. **Prédictions côté client uniquement** : la bibliothèque `cycle.ts` est pure (pas de Date.now(), `now` injecté). Serveur ne calcule rien — privacy maximale.

6. **Hydration-safe** :
   - `mounted` state (false côté SSR → skeleton, puis true au mount).
   - `now`, `viewYear`, `viewMonth` init 0/null côté SSR, settés dans useEffect.
   - `todayUTC(now)` injecté partout pour éviter `new Date()` côté rendu.
   - Aucun accès `localStorage` hors useEffect.

## Vérifications finales

- `bun run lint` → **0 erreur, 0 warning** (exit 0).
- `bun run db:push` → "Your database is already in sync" + Prisma Client regenerated.
- `curl http://localhost:3000/` → **HTTP 200** (424ms après recompile).
- `curl http://localhost:3000/api/cycle/sync` sans auth → **HTTP 401** (comportement attendu).
- `dev.log` propre : "Compiled in 168ms / 227ms / 457ms / 286ms", `GET / 200 in 424ms`. Aucune erreur runtime.

## Stage Summary
- Calendrier menstruel chiffré opérationnel dans le tab Carnet (section en bas).
- 1 modèle Prisma ajouté (`CycleSync`), 1 API route créée (`/api/cycle/sync` GET+POST).
- 1 bibliothèque de prédictions pure (`cycle.ts`, 0 dépendance externe, testable).
- 1 composant React client-side complet (`cycle-section.tsx`) avec calendrier natif, dialog multi-champs, liste cycles, sync cloud/local.
- Privacy by design maintenu : serveur ne voit JAMAIS le contenu du cycle (blob AES-256-GCM + IV base64).
- Palette Sankofa respectée : terracotta #B5684A (règles), vert-baobab (ovulation), ambre-couchant (fenêtre fertile), ocre-rouge (aujourd'hui). Zéro bleu/indigo.
- Hydration-safe : tous les `Date`/`localStorage` dans `useEffect`.
- Lint 0 erreur, HTTP 200 stable, API 401 sans auth (correct).
