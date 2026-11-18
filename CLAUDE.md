# PetApp: project brief

Gamified pet-care app ("o Duolingo do seu pet"). Owners log their pet's daily routine (food, water, walk, play) and health care (vaccines, dewormer, flea treatment, vet visits). An animated mascot named **Pipoca** (an original puppy) reacts to every action. Streaks, XP, levels and badges keep people coming back. Later: family members care for the same pet together, and AI-styled photo cards can be shared on Instagram Stories.

- **First market:** Brazil. All UI copy is **Portuguese (pt-BR)**; code and comments are English.
- **Design canvas (all screens):** https://claude.ai/artifact/22fYJMQjcsaN34eJDrCTPy
- **Business plan:** https://claude.ai/artifact/8jtzpmTdjdEQjh6nFTvEKC

## Stack decisions

- Expo + React Native + TypeScript, **expo-router** (file-based routes in `app/`).
- Expo SDK **~58** (React Native 0.88, React 19.3). The App Store Expo Go only runs the current SDK, so keep the project on whatever SDK it supports. To upgrade: get the expected versions from `npx expo install --check`, write them all into `package.json`, then delete `node_modules` and `package-lock.json` and run `npm install`. Bumping packages one at a time fails with ERESOLVE because the old ones are still installed.
- State: **zustand** with `persist` + AsyncStorage (`src/store/usePetStore.ts`). No backend yet.
- Drawing: **react-native-svg** for the mascot and icons. Animation: React Native's built-in `Animated` for now; Rive is planned for the final mascot.
- Fonts: Fredoka 600 (display) and Nunito 400/700/800 (body), via `@expo-google-fonts/*`.
- Path alias: `@/` → `src/`.

## Setup

```bash
npm install
npm run setup      # expo install of all SDK-matched deps + zustand + TS
npx expo start     # or: npm run web
npm run typecheck
```

`react-dom` is pinned through `expo install` on purpose: a transitive dependency otherwise pulls a react-dom that needs a newer React than the SDK ships, and `npm install` fails with ERESOLVE.

## What exists

- `package.json`, `app.json`, `tsconfig.json`, `.gitignore`
- `src/theme.ts`: colors, fonts, radius (match the design canvas)
- `src/store/types.ts`: Pet, Routine, DayLog, HealthItem, TaskId
- `src/store/usePetStore.ts`: persisted store; `completeOnboarding`, `tapTask`, `markHealthDone`, `dismissBadge`, `resetAll`, plus a `useHydrated()` hook
- `src/store/useOnboardingDraft.ts`: in-memory onboarding answers
- `src/lib/dates.ts`: local "YYYY-MM-DD" helpers
- `src/lib/pet.ts`: species labels, `de()` ("do"/"da" by sex), age from "mm/aaaa", default health items per species
- `src/lib/gamification.ts`: XP rules, levels, streak counting (`countRun`, `bestStreak`), badge definitions
- `src/lib/health.ts`: due status, sorting, pt-BR due labels, icon per health item
- `src/lib/reminders.ts`: pure reminder planning (`planReminders`), default meal times, ±30 min `shiftTime`, `formatTime` ("8h30")
- `src/lib/notifications.ts`: expo-notifications wrapper (permission, `applyPlan`); no-op on web
- `src/lib/useReminderSync.ts`: `<ReminderSync />` in the root layout rebuilds the queue on store changes and on app foreground; tapping a health reminder opens Saúde
- `src/lib/platform.ts`: `nativeDriver` flag (false on web), `haptic.*` (no-op on web), `confirmDestructive` (uses `window.confirm` on web)
- Milestone 1 below is built and was checked end to end in the web build and in Expo Go on the iOS Simulator (iPhone 17 Pro), and rechecked on the simulator after the move to SDK 58. It also opens on a physical iPhone in Expo Go. Not yet run on Android.
- On a physical iPhone, Expo Go requires the CLI (`npx expo login`) and the Expo Go app to be signed in to the same Expo account. Expo Go has no GitHub sign-in, so an account created through GitHub needs a password first (expo.dev → Forgot password). Then open `exp://<Mac LAN IP>:8081` in Safari, or pick the server under Development servers in Expo Go.
- `npx expo start --ios` can crash after opening the app when macOS denies its AppleScript call to focus Simulator. Workaround: `npx expo start`, then `xcrun simctl openurl booted exp://127.0.0.1:8081`.

On web, react-native-svg forwards unknown props to the DOM, so hide icons from screen readers with `aria-hidden` on a wrapping `View`, not RN accessibility props on `<Svg>`.

## Milestone 1 (done)

Components (`src/components/`):
- `Icon.tsx`: stroke SVG icons; export `type IconName` including at least `paw`, `ball`, `bowl`, `drop`, `shield`, `flame`, `trophy`, `star`, `heart`, `home`, `check`, `lock`, `chevron-left`.
- `Mascot.tsx`: Pipoca in SVG (head, floppy ears, muzzle, eyes, nose, tongue). Props `size`, `mood: 'neutral' | 'happy'`. Gentle bob loop when neutral, jump loop when happy (happy = arc eyes).
- `Button.tsx` (primary / secondary / yellow / ghost), `ProgressBar.tsx`, `OnboardingHeader.tsx` (back + "N de 4" progress), `AchievementModal.tsx` (shows `pendingBadge`, mascot happy, "Conquista desbloqueada", "Continuar" → `dismissBadge`). It is mounted in `(tabs)/_layout.tsx` so badges earned on any tab celebrate immediately.
- `TabBar.tsx`: custom tab bar passed to `Tabs` via `tabBar`. A floating white pill with a highlight that springs to the active tab, filled icon and hop when a tab becomes active, a light haptic on switch, and an orange dot on Saúde when a health item is overdue or due within 7 days.
- Also: `Screen.tsx` (safe area, status bar, optional scroll) and `PetAvatar.tsx`. `Mascot` additionally takes `wave` and `pulse` (change the number to make Pipoca hop once).

Routes (`app/`):
- `_layout.tsx`: load fonts, wait for `useHydrated()`, keep the splash screen until both are ready, headerless Stack.
- `index.tsx`: redirect to `/onboarding` or `/(tabs)` based on `onboarded`.
- `onboarding/`: `index` (welcome, purple background, waving mascot) → `species` (Cachorro / Gato / Outro) → `profile` (name required, breed, birth mm/aaaa, weight, sex) → `routine` (meals 1–4 stepper, walk goal 15/30/60 min) → `reminders` (meal times, streak and health switches; calls `completeOnboarding`) → `done` ("Tudo pronto!", pet card, go to tabs).
- `(tabs)/_layout.tsx`: tabs Hoje, Saúde, Conquistas, drawn by `TabBar`.
- `(tabs)/index.tsx` Hoje: pet header + streak pill; mascot card with speech bubble and "Vínculo de hoje N/4" bar; 2×2 task grid (Comida counts meals `x/meals`, Água, Passeio, Brincar) with haptics on tap; next health item card; `AchievementModal`.
- `(tabs)/health.tsx` Saúde: soonest-due item on top; list with status: no date → "Registrar última dose"; overdue → "Atrasado"; due ≤ 7 days → "Em breve"; else "Em dia". "Feito hoje" calls `markHealthDone`.
- `(tabs)/achievements.tsx` Conquistas: level card with XP bar, current streak, badge grid (unlocked vs locked), and a dev-only "Apagar dados" button with a confirmation alert.

Gamification rules (already in code): +10 XP per task, +40 when all 4 are done in a day, +30 per health record, 250 XP per level. A streak counts consecutive complete days.

## Milestone 2: reminders (done)

- Store `reminders: { enabled, mealTimes[], streak, health }` (persist version 2 migrates v1 with reminders off). `completeOnboarding(pet, routine, reminders)`, `setReminders(patch)`.
- No repeating triggers: the app keeps 7 days of one-off DATE notifications queued (iOS caps pending at 64; we keep ≤ 60) and rebuilds them on every relevant change, so a meal already logged cancels its reminder and the 20h "fechar o dia" nudge lists what's still missing. Health: 9h, 3 days before and on the due date; overdue nudges 1 and 4 days later.
- UI: onboarding step 4 `onboarding/reminders` (routine now pushes to it; it calls `completeOnboarding`), `app/reminders.tsx` (Lembretes, opened from the bell on Hoje) with a denied-permission card that opens system Settings. Shared `ReminderSettings` component.
- Checked on the iOS Simulator: permission prompt, 21 reminders queued, a test reminder rendered with the right copy. Not verified: tapping a reminder to open Saúde (simulator taps on the lock-screen card don't register), Android.
- Expo Go logs warnings that remote push isn't supported; local notifications work. In the simulator, a plain tap on a `Switch` may not register; use a short swipe across it.

## Later milestones

1. Health step in onboarding (Em dia / Atrasado / Não sei) + scan the vet card with AI.
2. Backend (Supabase is a good fit) for accounts and **family sync**: shared pet, who did what, invite by code/QR, roles (cuidador, pet sitter temporário, só acompanhar), weekly task schedule, a "já deram comida" warning against double feeding.
3. AI photo card: after a badge, ask for a photo with the pet, stylize it (Cartoon / Aquarela / Polaroid), overlay bond stats, share to Stories.
4. Paywall (Premium R$ 14,90/mês, Família R$ 19,90/mês, 7-day trial), likely via RevenueCat.

## Design rules

- Background `#F5F3FF`, white cards with large radius (20–28), primary purple `#5B3FD6`, yellow `#FFD25A` for streaks and rewards.
- Touch targets ≥ 44 px, text contrast ≥ 4.5:1, no emoji in the UI.
- Motion should feel premium (Waterllama and Finch are the references): every log action gives instant feedback from the mascot.
