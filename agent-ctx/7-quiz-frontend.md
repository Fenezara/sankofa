# Task 7-quiz — Work Record

**Agent**: main (frontend quiz)
**Task**: Add a gamified daily quiz to the Coach tab (Conseils)
**File modified**: `src/components/aya/coach-tab.tsx`

## What I implemented

A new `DailyQuiz` component (local to coach-tab.tsx) is rendered between
"Astuce du jour" and "Défi de la semaine" inside the existing scrollable
content area.

### Quiz bank
- **25 questions** across 5 domains (5 questions per domain):
  - SSR (q1, q2, q7, q8, q9)
  - Addictologie (q3, q10, q11, q12, q13)
  - Dermatologie (q4, q14, q15, q16, q17)
  - Santé mentale (q5, q18, q19, q20, q21)
  - Nutrition (q6, q22, q23, q24, q25)
- Each question has: id, domain, question, 4 options, correctIndex (0-3), explanation.
- Domain colors reused from the existing DOMAINS array (SSR=#D65430, Addictologie=#B84421, Dermatologie=#F5A623, Santé mentale=#5C3543, Nutrition=#2D4A2D).

### Daily selection (deterministic)
- `getDayOfYear(new Date())` computed in `useEffect` (client-only — hydration-safe).
- Index used: `dayOfYear % QUIZ_QUESTIONS.length` → same question for everyone on the same day.
- State `questionIndex` initialised to 0, updated in `useEffect` to match existing
  `tipIndex` hydration pattern already used in this file.

### UI flow
1. **Not answered today**: question card with 4 option buttons (A/B/C/D).
2. **After click**: 
   - Correct answer → green highlight (`bg-vert-baobab/15 border-vert-baobab/40`) + Check icon.
   - Wrong selected → red highlight (`bg-terracotta/15 border-terracotta/40`) + X icon.
   - Other wrong options → dimmed (`opacity-60`).
3. **Explanation box** (`bg-ambre-couchant/10 border-l-4 border-ambre-couchant rounded-r-lg p-3`):
   - "✓ Bonne réponse !" or "Pas tout à fait..." label
   - Explanation text
   - Score: "1/1" or "0/1"
   - "Quiz terminé !" label
   - "En savoir plus →" button that calls `onAskQuestion(...)` (the same handler used by Astuce du jour) to deep-link into Aya.

### Streak integration
- On correct answer: calls `updateStreak()` from `@/lib/streaks`.
- Compares `getStreak().current` before/after to detect whether the streak was actually incremented (it only increments once per day).
- If incremented: small badge "🔥 +1 jour" appears next to the title, and `toast.success("Bonne réponse ! +1 jour 🔥")`.
- If already counted today (e.g. user already opened the app): `toast.success("Bonne réponse ! 🔥")` (no badge).
- Calls `onStreakChange?.(updatedStreak)` to refresh the parent's Progression section in real-time.

### Weekly progress (7 dots Lun→Dim)
- Row of 7 dots labelled L/M/M/J/V/S/D.
- Filled (`bg-vert-baobab`) if quiz was answered that day, empty (`bg-ocre-rouge/15`) otherwise.
- When the user answers today's quiz, the dot for the current weekday is marked.
- Stored in `sankofa:quiz-week-{YYYY-WW}` (ISO week, e.g. `2025-34`).

### localStorage keys
- `sankofa:quiz-{YYYY-MM-DD}` = `{ questionId, selectedIndex, correct }` — single answer per day.
- `sankofa:quiz-week-{YYYY-WW}` = array of 7 booleans (Mon=0..Sun=6) — weekly progress.
- Keys computed once via `React.useMemo(..., [])` for stability.
- On mount: hydrates `answered`/`selectedIndex`/`weekProgress` state from localStorage (so reloading the page restores the answered state).

### Hydration safety
- All `localStorage` reads/writes inside `useEffect` (client-only).
- All `Date` computations (`getDayOfYear`, `getISOWeekId`, `getTodayStr`, `getDayIndexMonFirst`) happen inside `useEffect` or `useMemo` with `[]` deps.
- `questionIndex` initialised to 0 on both SSR and client → matches → no hydration mismatch.
- After hydration, `useEffect` updates to the actual day's question (one-time flicker, same pattern as existing `tipIndex`).

### Accessibility
- Each option button has `aria-pressed={isSelected}`.
- Weekly dots have a `title` attribute and an aria-label on the container.
- The "Quiz du jour" header uses semantic `<h3>` with the Bricolage font.
- All icons marked `aria-hidden="true"`.

### Visual palette (no blue/indigo)
- Card: `bg-creme-baobab rounded-2xl border border-ocre-rouge/10 p-4 shadow-sm` (matches other sections).
- Brain icon: `text-ocre-rouge`.
- Domain badge: colored chip using `${domainColor}1A` background, `${domainColor}40` border, `${domainColor}` text.
- Correct: `bg-vert-baobab/15 border-vert-baobab/40 text-vert-baobab`.
- Wrong selected: `bg-terracotta/15 border-terracotta/40 text-terracotta`.
- Explanation box: `bg-ambre-couchant/10 border-l-4 border-ambre-couchant`.
- Streak badge: `bg-terracotta/10 text-terracotta`.

## Verification

1. **`bun run lint`**: 0 errors, 0 warnings (exit code 0).
2. **curl http://localhost:3000**: HTTP 200, 91,068 bytes, 354ms.
3. **dev.log**: clean compilation (`✓ Compiled in 837ms`, `✓ Compiled in 206ms`, `✓ Compiled in 192ms`, `✓ Compiled in 224ms`), `GET / 200 in 353ms`. No runtime errors. No hydration warnings.
4. The Quiz section is rendered client-side only when the user navigates to the "Conseils" (Coach) tab — verified by checking that `page.tsx` conditionally renders `<CoachTab>` only when `activeTab === "coach"`. Initial HTML doesn't include the quiz, but it mounts cleanly when the tab is opened (dev.log shows successful compilation after my edits).

## Files
- MODIFY: `src/components/aya/coach-tab.tsx` (+ ~520 lines: quiz types, QUIZ_QUESTIONS array with 25 questions, helpers, DailyQuiz component, DailyQuiz insertion in JSX, header comment update, new imports for X/toast/cn/updateStreak)

## Stage Summary
- The Coach tab now has a gamified daily quiz with 25 health questions across 5 domains.
- Daily determinism: same question for everyone on the same day (dayOfYear % 25).
- Streak integration: correct answer increments streak once per day via existing `updateStreak()`, and the Progression section above refreshes in real-time thanks to the `onStreakChange` callback.
- Weekly progress: 7 dots (Lun→Dim) tracked in localStorage per ISO week.
- Toast feedback: "+1 jour 🔥" when streak was incremented, simple "🔥" otherwise, "Pas tout à fait" on wrong answer.
- Hydration-safe: all Date and localStorage access in `useEffect`.
- Accessibility: aria-pressed, aria-label, titles, semantic h3.
- Palette respected: creme-baobab / ocre-rouge / terracotta / vert-baobab / ambre-couchant — zero blue/indigo.
- Lint clean, dev server clean, page returns 200.
