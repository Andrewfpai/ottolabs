# OttoLabs

A personal learning dashboard. Start a timer against a **track** (a topic you're
learning), accumulate hours, and get honest analytics back about *when* and
*how much* you actually focus.

## Status

**Phase 2 complete** — focus mode, Pomodoro cycles with break accounting, and
the idle-return prompt, on top of the Phase 1 timer engine.
See [`docs/PLAN.md`](docs/PLAN.md) for the full plan.

| Phase | Scope | State |
|---|---|---|
| 0 | Scaffold, auth, schema, design tokens, seeder | ✅ done |
| 1 | Tracks CRUD + timer engine + session log | ✅ done |
| 2 | Focus mode, Pomodoro, idle-return prompt (heartbeat + reaper landed in Phase 1) | ✅ done |
| 3 | Tasks + calendar | ✅ done |
| 4 | Analytics + goals | ✅ done |
| 5 | Polish, PWA, deploy | ✅ done |
| 1.1 | Google Calendar sync | deferred |

## Setup

You need two external things before the app will run: a Neon database and a
Google OAuth client. Both are free.

### 1. Database (Neon)

1. Create a project at <https://console.neon.tech> (free tier, no card).
2. Create a **`dev`** branch off `main` — dev work never touches real data.
3. Copy the **pooled** connection string for `dev`.
4. Paste it into `.env.local` as `DATABASE_URL`.

### 2. Google OAuth

1. Open <https://console.cloud.google.com/apis/credentials>.
2. Create an **OAuth client ID**, type **Web application**.
3. Add the authorized redirect URI:
   `http://localhost:3000/api/auth/callback/google`
4. Put the client ID and secret into `.env.local` as `AUTH_GOOGLE_ID` and
   `AUTH_GOOGLE_SECRET`.

`AUTH_SECRET`, `CRON_SECRET` and `ALLOWED_EMAILS` are already filled in.
`ALLOWED_EMAILS` names the **owners**: always allowed in, and the only people
who can invite others. Everyone else needs an invite, added by an owner under
**Settings → Access** and stored in the `allowed_emails` table. Owners live in
the environment on purpose — on an empty database something outside the app
has to say who the owner is — and they can never be locked out by an edit in
the app. Each invited person gets their own separate data.

Removing an invite signs that person out on every device. Access is re-checked
on every request, so it takes effect immediately.

### Keep production out of reach

Set `PRODUCTION_DATABASE_ENDPOINT` in `.env.local` to the production branch's
endpoint. `db:seed`, `db:clear` and `verify:timer` then refuse to touch it
unless you add `--production`, and `db:push` labels it `<-- PRODUCTION` before
changing anything. Point `DATABASE_URL` at a `dev` branch for day-to-day work.

### 3. Create the tables and start

```bash
npm run db:push
```

```bash
npm run dev
```

Sign in once at <http://localhost:3000>, then load 90 days of realistic
synthetic data:

```bash
npm run db:seed
```

### Troubleshooting

**`[auth][error] TypeError: fetch failed` on sign-in, or `error=Configuration`**

Node's built-in `fetch` ignores `HTTP_PROXY` / `HTTPS_PROXY`. If you run a local
proxy (Clash, V2Ray, etc. — typically `127.0.0.1:7890`) and direct access to
`accounts.google.com` is blocked, Auth.js times out fetching Google's OIDC
discovery document while `curl` to the same URL works fine.

The `dev`, `build`, `start` and `db:seed` scripts set
`NODE_OPTIONS=--use-env-proxy`, which makes Node honour the proxy variables.
This requires **Node 24+** and is a no-op on machines with no proxy configured.
If you invoke `next` directly rather than through npm, set it yourself.

## Install it like an app

Once deployed over HTTPS (or on `localhost`), the app is installable:

- **iPhone / iPad:** open it in Safari → Share → **Add to Home Screen**.
- **Android:** Chrome menu → **Install app**.
- **Desktop Chrome / Edge:** the install icon at the right of the address bar.

It opens on the dashboard in its own window. There is no offline mode on
purpose: the timer depends on the server's clock and data, so a cached copy
would only show stale numbers. Icons are drawn in code (`src/lib/brand-icon.tsx`)
and the manifest lives in `src/app/manifest.ts`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, incl. React Compiler rules |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:push` | Apply the schema straight to the database |
| `npm run db:studio` | Browse and edit data |
| `npm run db:seed` | Seed ~90 days of synthetic sessions and tasks |
| `npm run db:seed -- --reset` | Wipe this user's data first, then seed |
| `npm run db:clear -- --yes` | Delete tracks/sessions/tasks, keep the account |
| `npm run verify:timer` | End-to-end check of the timer state machine, Pomodoro breaks, idle trim and reaper (needs the dev server up) |

## Architecture notes

**Time is the whole product, so the time handling is deliberate.**

- **Timestamps, never counters.** A focus session stores when it started, not a
  running total. Elapsed time is derived as
  `(endedAt ?? now) - startedAt - pausedMs - openPause`. This is refresh-safe
  and immune to browsers throttling timers in background tabs, because the
  answer never depends on how often it was sampled.
  All of it lives in one place: `src/lib/time/elapsed.ts`. Do not write a
  second implementation.
- **Clock skew is corrected.** `src/lib/time/clock.ts` measures the offset
  between the browser and the server on load, so a laptop with a wrong clock
  doesn't produce a nonsense timer. Use `clock.now()`, not `Date.now()`, on the
  client.
- **One live session, enforced by the database.** A partial unique index
  (`focus_sessions_one_live_per_user`) makes a second concurrent start
  impossible rather than merely unlikely.
- **`breakMs` is a subset of `pausedMs`**, not additive. A Pomodoro break is
  recorded as a pause so it's excluded from focus time, and separately tallied
  so it can be reported. `break_started_at` marks which open pause is a break,
  so finishing or being reaped mid-break banks it in both places. Aggregates
  therefore only ever subtract `paused_ms` — subtracting both would deduct
  every break twice.
- **The Pomodoro phase is derived, not counted down.** Time left in a work
  interval is `(completedCycles + 1) × workMinutes − focusSoFar`; time left in
  a break runs from `break_started_at`. Nothing to persist, nothing to keep in
  sync, and a refresh mid-cycle lands exactly where it left off. See
  `src/features/sessions/lib/pomodoro.ts`.
- **Cycle transitions only fire while the tab is in front.** Auto-starting a
  break in a hidden tab would delete focus time you were genuinely earning
  elsewhere; auto-resuming work in one would credit you for time at lunch. A
  hidden tab simply lets the phase run over, which is reported honestly.
- **The idle-return prompt** asks what to do when you come back to a timer that
  ran while the tab was buried for more than ten minutes: keep it, trim the
  away time out of it, or discard the session. The heartbeat and reaper handle
  never coming back; this handles coming back late.

**Other conventions**

- `features/*/server/` is the only code that touches `db`. Everything else
  imports from a feature.
- Route protection lives in `src/app/(app)/layout.tsx`. Next.js documents proxy
  (formerly middleware) as unsuitable for session management. Server Actions are
  reachable by direct POST, so each one calls `requireUser()` itself.
- Auth.js owns a table named `sessions`. Ours is `focus_sessions`. The
  distinction is load-bearing.
- Tracks store a colour *name*, never a hex value. The palette lives in
  `globals.css` and `src/lib/track-colors.ts`.
- `/focus` is not in the sidebar: it is a mode you enter from a running timer
  (the expand button on the timer bar), not a place you browse to. `Space`
  pauses, `Esc` leaves. The timer morphs between the mini bar and the
  fullscreen dial via a shared `layoutId` — both sides read it from
  `src/features/sessions/lib/timer-layout.ts`.
- The heartbeat, the Pomodoro engine and idle detection each run in exactly one
  place: `TimerBar`, which the app shell mounts on every authenticated route.
  Two copies would race to make the same cycle transition.

## Friends and study rooms

**Friends** are mutual: a request has to be accepted before either side sees
anything. Add someone by **username** (`users.username`, chosen in Settings,
lowercase letters, digits and underscores) or by email. Everyone can also pick one of
17 built-in animal **avatars** (hand-drawn SVG in `components/animal-avatar.tsx`,
stored as an id in `users.avatar`) instead of their Google photo. A friend's profile is the Analytics page computed on their sessions,
in their time zone. **Study rooms** are small groups (up to 12) who see each
other's live timers; the owner adds friends, and joining is the consent to be
seen. Sessions started from inside a room carry its `room_id`, which is what
"time focused together" counts.

What is ever shared: focus time, streaks, patterns, and — in rooms or with
the live-status switch on — whether your timer is running, on which track and
for how long. Track names only if you switch that on; otherwise "Track 1, 2…".
**Never shared:** session notes, tags, tasks.

Every friend and room read goes through one gate (`acceptedFriend`,
`joinedRoom`); anything else is a 404 that does not confirm the person or room
exists. Rooms poll `/api/rooms/[id]/live` every 10 seconds — Vercel functions
cannot hold the sockets real-time would need — while minutes tick locally from
timestamps.

## Speed: keep the server next to the database

`vercel.json` pins functions to Singapore (`sin1`), next to the Neon database
(`ap-southeast-1`). Vercel's default is Washington D.C.; from there every
database round trip crosses the world (~220 ms), and a page needs about seven
in a row, which made every click take 1–2 s. If the database ever moves, move
`regions` with it.

`next.config.ts` also keeps visited pages in the browser for 30 seconds
(`staleTimes.dynamic`), so going back and forth is instant. Every save calls
`revalidatePath`, which clears the affected page, so your own changes always
show; changes from another device can take up to 30 s.

## Alerts and reminders

- **Pomodoro bell and notification** come from the open page: one precise
  timeout per phase (`usePomodoroAlerts`), ringing in a background tab too.
  Preferences are per device. Transitions still wait for a visible tab.
- **Reminders** are server-sent Web Push, so they arrive with the app closed:
  deadlines tomorrow and the daily-goal gap from `/api/cron/reminders` (daily
  at 12:00 UTC, each person only on their local evening), and room activity
  sent via `after()` when someone starts in a room. `reminder_log` makes each
  one at-most-once. Needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
  and `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`).
- `public/sw.js` only shows notifications. No fetch handler, no cache.
- iPhone and iPad receive push only from the Home Screen app (iOS 16.4+).

## Tasks as sub-items of a track

A task filed under a track appears on that track's card. Pick one there (or use
Start timer in the task's menu) and the session records to it through
`focus_sessions.task_id`, so the time counts toward the track and toward the
task. Starting moves a to-do to in progress; the finish dialog can tick it off.
Deleting a task keeps its time on the track (`on delete set null`).

## Milestones, cheers, reviews and focus sounds

- **Milestones** (`features/achievements`): 15 goals, from 10 focused hours to
  a 100-day streak, each unlocking an avatar accessory drawn in
  `components/avatar-accessories.tsx`. Unlocks are written to `achievements`
  when a session finishes or a task or review is done (and caught up on the
  Milestones page). What you wear is `users.accessories`, one per slot, and
  travels inside the avatar picture string, so friends and rooms see it.
- **Cheers**: a 👏 or 🔥 to a friend, once per friend per three hours, sent
  as a push and listed on the Friends page.
- **Reviews**: a finished task can return in 3, 7 and 21 days
  (`tasks.review_stage`, `tasks.review_due_at`); due ones head the Tasks page
  and arrive in the evening push.
- **Focus sounds** (`features/sounds`): rain, café, brown noise, ocean and
  fire, synthesised with Web Audio from noise beds and scheduled events. No
  audio files. Driven once from `TimerBar`; preferences per device.

## Focus mode, invite links and room links

- **Focus mode** (`/focus`) sits over a full-screen scene: five pixel-art
  landscapes drawn in code (`features/focus/components/scenes.tsx`, seeded so
  server and browser agree) or your own picture, kept in this browser's
  IndexedDB. Its toolbar opens the background picker, session notes (saved
  into the running session's note as you type), Study together, focus sounds
  and fullscreen. With nothing running it offers to start.
- **Invite links** (Settings → Access): one-time links an owner makes for a
  named person. The token is stored only as a SHA-256 hash and travels
  through Google sign-in in a short-lived cookie; the sign-in callback spends
  it and adds whichever Google address came back to `allowed_emails`.
- **Room links**: each room has a secret `invite_code` (`/rooms/join/<code>`)
  the owner can copy or replace. Anyone with access may join while there is
  space. A running session can be moved into a room from focus mode.

## The stale-session reaper

A timer whose heartbeat has been silent for 30 minutes is closed **at its last
heartbeat** rather than at the moment it is noticed, so a closed laptop logs
the 90 minutes you actually studied instead of 13 hours of fiction. The logic
lives in `src/features/sessions/server/reaper.ts` and runs two ways:

- **Lazily**, for you, every time the app reads your running session. Opening
  the app the next morning shows yesterday's session already closed.
- **Daily**, for everyone, via `/api/cron/reap-sessions` (scheduled in
  `vercel.json` at 20:00 UTC). This is only a backstop for timers nobody comes
  back to, which is why Vercel Hobby's once-a-day cron limit is enough.

The route refuses to run without `CRON_SECRET` in the `Authorization` header,
so it is safe to leave exposed.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui
(Radix) · Motion · Drizzle ORM · Neon Postgres · Auth.js v5 · TanStack Query ·
Recharts · Vitest
