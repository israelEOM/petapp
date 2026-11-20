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
npm test           # Jest (jest-expo) unit tests in src/**/__tests__
```

`react-dom` is pinned through `expo install` on purpose: a transitive dependency otherwise pulls a react-dom that needs a newer React than the SDK ships, and `npm install` fails with ERESOLVE.

## What exists

- `package.json`, `app.json`, `tsconfig.json`, `.gitignore`
- `src/theme.ts`: colors, fonts, radius (match the design canvas)
- `src/store/types.ts`: Pet, Routine, DayLog, HealthItem, TaskId
- `src/store/usePetStore.ts`: persisted store (version 3); `completeOnboarding`, `tapTask`, `markHealthDone`, `dismissBadge`, `resetAll`, plus a `useHydrated()` hook. Activities are the source of truth; `logs` and `xp` are derived from them on every change and on load (not persisted)
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
- `Button.tsx` (primary / secondary / yellow / ghost), `ProgressBar.tsx`, `OnboardingHeader.tsx` (back + "N de 5" progress), `AchievementModal.tsx` (shows `pendingBadge`, mascot happy, "Conquista desbloqueada", "Continuar" → `dismissBadge`). It is mounted in `(tabs)/_layout.tsx` so badges earned on any tab celebrate immediately.
- `TabBar.tsx`: custom tab bar passed to `Tabs` via `tabBar`. A floating white pill with a highlight that springs to the active tab, filled icon and hop when a tab becomes active, a light haptic on switch, and an orange dot on Saúde when a health item is overdue or due within 7 days.
- Also: `Screen.tsx` (safe area, status bar, optional scroll) and `PetAvatar.tsx`. `Mascot` additionally takes `wave` and `pulse` (change the number to make Pipoca hop once).

Routes (`app/`):
- `_layout.tsx`: load fonts, wait for `useHydrated()`, keep the splash screen until both are ready, headerless Stack.
- `index.tsx`: redirect to `/onboarding` or `/(tabs)` based on `onboarded`.
- `onboarding/`: `index` (welcome, purple background, waving mascot) → `species` (Cachorro / Gato / Outro) → `profile` (name required, breed, birth mm/aaaa, weight, sex) → `routine` (meals 1–4 stepper, walk goal 15/30/60 min) → `health` (Em dia / Atrasado / Não sei per default health item; Em dia also asks the month of the last dose) → `reminders` (meal times, streak and health switches; calls `completeOnboarding`) → `done` ("Tudo pronto!", pet card, go to tabs).
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

## Milestone 3: health step in onboarding (done)

- Answers live in the onboarding draft (`health: Record<id, HealthAnswer>`) and are applied by `applyAnswer` (`src/lib/health.ts`) when the reminders step calls `completeOnboarding(pet, routine, reminders, health)`.
- Guessed dates are marked on the item with `guess: 'month' | 'late'` (cleared by "Feito hoje"). Em dia → the 15th of the picked month (today for the current month). Atrasado → due yesterday, and labels say just "Atrasado" / "data não informada" instead of inventing a day count. Guesses don't count toward the "Saúde em dia" badge.
- Checked on the iOS Simulator end to end (dog): answers show in Saúde, the Saúde dot appears for the overdue item.

## Milestone 4: accounts and family sharing (in progress)

Plan: `~/.claude/plans/shimmering-leaping-nova.md` (6 phases: sign-in, schema + moving the local pet, sync engine, family/invites/roles, double-feed warning + schedule, server push). The account stays optional.

- **Supabase project:** ref `yucybgxdbkbukulouxes` (eu-west-1, free tier), formerly NeoSkin. NeoSkin's schema and data were wiped on 2026-11-19 (no backup); its 4 edge functions (`delete-account`, `export-data`, `assessment-worker`, `generate-routine`) and storage buckets (`analysis-scans`, `exports`) are still there and unused. Existing auth users are NeoSkin's.
- `.env.local` (gitignored): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `APPLE_SIGN_IN` / `EXPO_PUBLIC_APPLE_SIGN_IN` (`1` once there's a paid Apple Developer team). `app.config.ts` adds the Google/Apple plugins only when those are set.
- Migrations live in `supabase/migrations/`; the folder is linked (`supabase/.temp`). The default `node` on this Mac is v12, too old for the CLI: run it as `PATH=/opt/homebrew/bin:$PATH npx supabase@latest ...`. Remote `db push`/`dump` need the database password (`SUPABASE_DB_PASSWORD`); the CLI's temporary login role fails on this project. Without it, run SQL in the dashboard's SQL editor and record the version in `supabase_migrations.schema_migrations`.
- Phase 1 (built, sign-in not yet tested): `src/lib/supabase.ts` (client, session in SecureStore in chunks; `null` without env), `src/store/useSession.ts` (`startSessionSync()` in the root layout, `accountsEnabled`), `src/lib/auth.ts` (Google/Apple ID token → `signInWithIdToken`, pt-BR errors), `app/account/sign-in.tsx` (modal), account card on Conquistas, "Salvar e compartilhar com a família" on onboarding `done`. Migration `20261119000000_profiles` (profiles + `on_auth_user_created` trigger) is applied.
- Phase 2 schema (`20261119010000_family`) is applied: `pets`, `pet_members` (owner/caregiver/sitter/viewer), `activities` (append-only, client UUIDs, undo = `deleted_at`), `health_items` (a health activity moves `last_date` and clears `guess` via trigger), `badges`, `schedule`, `invites` (`create_invite()` / `redeem_invite()`, 6-char codes, 48 h), `push_tokens`; RLS on all, Realtime on the shared tables. `supabase/tests/rls_check.sql` checks every role (paste into the SQL editor; it rolls itself back and prints the result).
- `src/lib/migrateLocal.ts` (`linkLocalPet`): on sign-in (`useSession.linkAccount`), uploads the local pet, health items, history as one activity per meal/task (stable UUIDs, so retries don't duplicate) and badges, under `cloudPetId` (persisted in the pet store before upload). If the account already has another pet, `link.status` is `'cloud'` (no UI for that choice yet). Not yet run against the server from the app.
- **Dev build (EAS):** local `npx expo run:ios` fails with Xcode 26.3 (Swift 6.2): `expo-modules-jsi` 58.0.23 hits a Swift concurrency error; SDK 58 targets Xcode 27. So the iOS simulator dev build comes from EAS: `eas.json` profile `development` (simulator, dev client), Expo project `@israel.medeiros/petapp`. Build: `PATH=/opt/homebrew/bin:$PATH npx eas-cli@latest build -p ios --profile development`, download the `.tar.gz`, `xcrun simctl install booted PetApp.app`, then `npx expo start --dev-client` and open `petapp://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`. Rebuild only when native deps or `app.config.ts` plugins change (e.g. after adding the Google iOS client ID); JS changes load from Metro. EAS doesn't upload `.env.local`, so build-time env (Google/Apple plugins) must be set as EAS environment variables. `pod install` needs `LANG=en_US.UTF-8` here.
- Google sign-in works on the EAS simulator build (checked 2026-11-20): Google Cloud project `petapp-515222` (Google Auth Platform in testing mode, External; only listed test users can sign in), web client "PetApp web (Supabase)" and iOS client "PetApp iOS". Their IDs are in `.env.local` and in the EAS `development` environment (`eas env:create`; `eas.json` development profile uses it). The Supabase Google provider lists both IDs and has "Skip nonce checks" on; its client secret is still NeoSkin's until the user pastes the new one (the ID-token flow doesn't use it). Signing in, the profile, the account card and uploading the local pet (Thor: pet, owner row, health items) were checked against the server. Migration `20261120000000_backfill_profiles` gives profiles to auth users that predate the trigger (NeoSkin accounts). Apple sign-in waits for a paid Apple Developer team.

## Milestone 4, phase 3: sync engine (built 2026-11-20)

- Every tap is an `Activity` (`src/store/types.ts`): client UUID, kind, local day, `deletedAt` for undo. `src/lib/activities.ts` holds the pure logic: `tapChanges` (food adds up to the goal then clears the day; water/walk/play toggle and an off-tap removes every live one that day), `deriveLogs`, `deriveXp` (+10 per task with meals capped at the goal, +40 complete day, +30 per health dose), `mergeActivities`, the v2→v3 conversion and row mapping. Tests: `src/lib/__tests__/activities.test.ts`.
- Store v3 migration turns saved logs into activities with the same stable ids the first upload used (`src/lib/ids.ts`, seed `petapp:<cloudPetId or 'local'>:<day>|<kind>|<item>:<n>`). XP is recomputed; old extra health doses beyond the last one aren't recoverable.
- `outbox` (id → local revision) holds changes not yet on the server; `markPushed` only clears entries unchanged during the push. `linkedUserId` marks the account whose upload finished; only then does sync run.
- `src/lib/sync.ts`: push outbox + badges, pull activities since `syncCursor` (10 s overlap) plus health items and badges, Realtime channel per pet (any change schedules a pull), runs on local change (500 ms debounce), app foreground and after link; retries with backoff up to 60 s. `downloadPet` fetches a whole pet.
- Account already has another pet: link status `'cloud'`; Conquistas shows "Sua conta já tem o X" with "Usar dados da nuvem" (`switchToCloudPet` → `adoptCloudPet`). On a phone with no pet it switches automatically. The welcome screen has "Já tenho conta"; once the pet arrives it routes to the tabs. Erasing local data stops sync.
- Checked on the iOS Simulator against Supabase: taps and undos reach the server; a server-side change (as another phone) shows up live via Realtime; erasing local data and relaunching downloads the account's pet; taps after that sync. Not yet checked: two simulators at once, offline then reconnect, `npm test` covers only the pure logic.

## Milestone 4, phase 4: family (built 2026-11-20)

- `src/store/useFamily.ts` (persisted `petapp-family`): members of the current pet with names, `removed` flag, `ROLE_LABEL`, `accessFor` (solo/unlinked = full access). `src/lib/useAccess.ts` gives `{ me, canLog, isOwner, shared }`. Sync refreshes members (pet_members + profiles) before every push/pull; if this account is no longer a member it stops and sets `removed`. Push drops rows the server refuses with 42501 (viewer, expired sitter) instead of retrying forever. Realtime also listens to `pet_members`; channel names are unique per subscribe (a reused name breaks after hot reload).
- `src/lib/family.ts`: `createInvite`, `redeemInvite` (pt-BR errors), `setMemberRole`, `removeMember`; `src/lib/inviteCode.ts`: strict code parsing from typed text, links and shared messages. `useSession.joinWithCode` redeems, downloads and adopts the pet; `leaveFamily` removes the membership and clears the phone.
- Screens: `app/family/index.tsx` (members, owner taps a member to make caregiver / viewer or remove; others can leave; removed state), `app/family/invite.tsx` (role, sitter length 3/7/14/30 days ending 23:59, code + QR of `petapp://convite/CODE`, share sheet), `app/family/join.tsx` (code field, QR scan via `expo-camera` loaded lazily so older builds still open the screen), `app/convite/[code].tsx` (deep link). Entry points: Família card on Conquistas, "Tenho um convite" on the welcome screen.
- Hoje: when more than one person cares for the pet, task cards say who did it ("1/2 · Ana · 8h10") and "Hoje na família" lists today's activities. Viewers and expired sitters get a notice and taps only make Pipoca explain; Saúde hides "Feito hoje" for them.
- Checked on the iOS Simulator: invite created in the app (code + QR); a test account "Ana Teste" (`ana@petapp.test`, created in the dev database by SQL) redeemed it through `redeem_invite`; Ana and her meal appeared live on Família and Hoje; changing her role to "Só acompanha" from the app synced. Not checked: the join screen end to end with a real second account, scanning a real QR code (the scanner opens and asks for the camera, but the simulator has no camera), the viewer/expired-sitter UI from that person's side, Android.

## Milestone 4, phase 5: double feeding and weekly schedule (built 2026-11-20)

- Tapping Comida to add a meal when another member logged one in the last 3 hours asks first: "Ana já deu comida às 8h10 / Registrar outra refeição do Thor?" (`recentMealByOther` in `src/lib/whoDid.ts`; only meals already synced to this phone count). `confirmAction` in `src/lib/platform.ts` is the web-safe two-button confirm.
- Weekly schedule ("Quem faz o quê"): `src/lib/schedule.ts` (pure helpers), synced into `useFamily.schedule` with the members (Realtime on `schedule` too), saved by `saveSchedule` (upsert the new cells, then delete only the cleared ones). Screen `app/family/schedule.tsx`, opened from Família: weekday row, one row per task; the owner picks who (owner, caregivers and active sitters) or "Ninguém", and can repeat a day across the week; others see it read-only. On Hoje, an undone task assigned for today says "Hoje é sua vez" or "Vez de Ana hoje".
- Checked on the iOS Simulator: the warning shows for the test member's meal, assignments save (14 rows after "repetir na semana"), and Hoje shows the turn. Not checked: the schedule as seen by a non-owner.
- Metro on this Mac doesn't notice file changes (npm skipped `@parcel/watcher`'s install script), so after edits restart it with `npx expo start --dev-client --clear` and relaunch the app.

## Milestone 4, phase 6: server notifications (built 2026-11-20, waiting on Apple push)

- Migration `20261120010000_notifications` (applied): `profiles.notify_family`, `reminder_prefs` (per member and pet: enabled, meal times, streak, IANA `tz`), `notification_log` (send keys, service role only, cleaned after 14 days), trigger `activities_notify` → pg_net POST to `notify-activity`, pg_cron job `petapp-due-reminders` every 15 min → `due-reminders`.
- Edge functions (`supabase/functions/`, Deno, deployed with `--no-verify-jwt`; they read everything with the service role and take no trusted input): `notify-activity` ({ id }) tells the other members "Ana deu a 1ª refeição do Thor" (skips activities older than 10 min, i.e. history uploads; respects `notify_family`); `due-reminders` sends meal reminders to whoever is on duty (schedule, else every member with reminders on) only if nobody logged that meal, and the 20h "fechar o dia" nudge with what's missing; solo pets, viewers and expired sitters are skipped. `_shared/push.ts` sends via the Expo push API and deletes `DeviceNotRegistered` tokens. Deploy: `PATH=/opt/homebrew/bin:$PATH npx supabase@latest functions deploy <name> --no-verify-jwt --use-api --remote=yucybgxdbkbukulouxes --yes` (the CLI asks for consent; get the user's OK first). Type-check: `deno check supabase/functions/*/index.ts`. The app's `tsconfig` excludes `supabase/functions`.
- App: `src/lib/pushSync.ts` registers the Expo push token once notification permission is granted (never prompts), uploads reminder prefs, and deletes the token on sign-out. For shared pets, `useReminderSync` stops scheduling local meal and streak reminders (health stays local). Lembretes shows an "Avisos da família" switch for shared pets.
- Checked against Supabase with fake Expo tokens: a new activity reached `notify-activity` through the trigger (1 recipient, Expo rejected the fake token, token removed); `due-reminders` planned a due meal reminder for the test member and handled the rejected token the same way; the app uploaded its reminder prefs. Test rows were removed. Not possible yet: real delivery to an iPhone needs the paid Apple Developer team, an APNs key on EAS (`eas credentials`) and the push entitlement; then test on two physical iPhones.

## Later milestones

1. Scan the vet card with AI to fill health dates.
2. Backend (Supabase is a good fit) for accounts and **family sync**: shared pet, who did what, invite by code/QR, roles (cuidador, pet sitter temporário, só acompanhar), weekly task schedule, a "já deram comida" warning against double feeding.
3. AI photo card: after a badge, ask for a photo with the pet, stylize it (Cartoon / Aquarela / Polaroid), overlay bond stats, share to Stories.
4. Paywall (Premium R$ 14,90/mês, Família R$ 19,90/mês, 7-day trial), likely via RevenueCat.

## Design rules

- Background `#F5F3FF`, white cards with large radius (20–28), primary purple `#5B3FD6`, yellow `#FFD25A` for streaks and rewards.
- Touch targets ≥ 44 px, text contrast ≥ 4.5:1, no emoji in the UI.
- Motion should feel premium (Waterllama and Finch are the references): every log action gives instant feedback from the mascot.
