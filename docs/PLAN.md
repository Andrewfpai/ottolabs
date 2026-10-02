> Original MVP plan, approved 2026-08-21. Kept as written; where the code has
> since diverged (e.g. Next.js 16, not 15), the code and README win.

# Personal Learning Dashboard — MVP Plan

## Context

`D:\OttoLabs` is empty; this is a greenfield build. The goal is a personal dashboard for
tracking self-directed learning: start a timer against a topic, accumulate hours, and get
honest analytics back about *when* and *how much* you actually focus.

The reference screenshots (Timylabs) supplied the **feature ideas only** — not the UI, and
explicitly not the gamification layer (XP, ranks, mood, music, shop). Those compete with the
data for attention and are cut. See "Deliberately out of scope".

### Decisions locked in

| Decision | Choice | Why |
|---|---|---|
| Name for the trackable unit | **Track** | "Databases track". Reads well everywhere — `Tracks`, `New track`, `Time by track` — without implying a fixed curriculum the way "Path" does. |
| Database | **Neon** free tier + **Drizzle ORM** | Plain Postgres, no lock-in. Free `dev` branch via Neon branching so you never test against real data. Drizzle is a library (MIT, free forever), not a service. |
| Auth | **Auth.js v5 + Google**, day one | Locked to your email. In v1.1 the Calendar scope appends to the *same* OAuth grant — no migration, no retrofitting `user_id` onto populated tables. |
| Google Calendar sync | **Deferred to v1.1** | But sync columns ship nullable from day one so it bolts on without a migration. |
| Extras in v1 | Focus mode + Pomodoro · Session notes on stop · Goals & streaks | Command palette deferred. |

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router, React 19, TS strict | Server Components for reads, Server Actions for writes |
| Styling | Tailwind CSS v4 + shadcn/ui | Radix primitives, owned in-repo, composes cleanly with Motion |
| Animation | `motion` (framer-motion v12+, renamed pkg) | import from `motion/react` |
| DB / ORM | Neon Postgres + `drizzle-orm/neon-serverless` | **WebSocket Pool driver, not `neon-http`** — the http driver can't do real transactions, and finishing a session is a multi-write op |
| Auth | `next-auth@beta` + `@auth/drizzle-adapter` | Google provider, email allowlist |
| Client cache | TanStack Query v5 | Optimistic timer/task mutations with rollback |
| Charts | Recharts (via shadcn chart wrappers) | Heatmap is hand-rolled SVG — Recharts is bad at grids |
| Validation | Zod | One schema shared by form + server action |
| Dates | `date-fns` + `@date-fns/tz` | Timezone correctness is load-bearing here |
| Jobs | Vercel Cron | Stale-session reaper |
| Deploy | Vercel (CLI already installed) | |

**Setup note:** `uipro-cli` is installed globally but its skill isn't in `~/.claude/skills`.
Run `uipro` inside the project root in Phase 0 so it's available during UI work.

---

## Data model

> **Naming collision to avoid:** Auth.js owns a table called `sessions` (login sessions).
> Ours is **`focus_sessions`**. Do not shorten it.

**Auth.js tables** — `users`, `accounts`, `sessions`, `verification_tokens`, standard Drizzle
adapter schema, untouched.

```
tracks
  id uuid pk · user_id fk cascade
  title text not null · description text
  color text                          -- design token name, never a raw hex
  icon text
  status enum('active','paused','archived') default 'active'
  target_minutes_per_week int         -- goals extra
  sort_order int · archived_at · created_at · updated_at
  unique (user_id, title)

focus_sessions
  id uuid pk · user_id fk · track_id fk (on delete restrict — keep history)
  started_at timestamptz not null
  ended_at   timestamptz              -- NULL = live
  paused_ms  int default 0            -- accumulated paused time
  paused_at  timestamptz              -- non-null = currently paused
  break_ms   int default 0            -- pomodoro breaks, excluded from focus totals
  mode enum('stopwatch','pomodoro') default 'stopwatch'
  pomodoro_config jsonb · completed_cycles int default 0
  note text                           -- session journal
  tags text[]
  last_heartbeat_at timestamptz
  end_reason enum('manual','auto_closed','discarded')
  created_at

  -- one live session per user, enforced in the DB not the app:
  CREATE UNIQUE INDEX one_live_session ON focus_sessions (user_id) WHERE ended_at IS NULL;
  index (user_id, started_at desc) · index (track_id, started_at desc)

tasks
  id uuid pk · user_id fk · track_id fk nullable (on delete set null)
  title text not null · notes text
  due_at timestamptz nullable · is_all_day bool default false
  status enum('todo','in_progress','done','cancelled') default 'todo'
  priority enum('p1','p2','p3') default 'p3'
  completed_at · sort_order · created_at · updated_at

  -- v1.1 Google sync, nullable and unused in v1:
  google_event_id text · google_calendar_id text · google_etag text
  synced_at timestamptz
  sync_state enum('local','synced','pending_push','conflict') default 'local'

  index (user_id, due_at) · index (user_id, status)

user_settings
  user_id pk
  timezone text                       -- seeded from Intl.DateTimeFormat().resolvedOptions().timeZone
  day_start_hour int default 4        -- night-owl day boundary: 1am work counts as "yesterday"
  daily_goal_minutes int default 120
  week_starts_on int default 1
  default_pomodoro jsonb · theme text
```

Streaks are **computed, not stored** — derived from `focus_sessions` with the `day_start_hour`
offset applied. Cache only if it ever measurably slows down.

---

## The timer (highest-risk component — get this right first)

**Server-authoritative. The client never owns the truth.** State machine:
`idle → running ⇄ paused → ended`.

> **In plain English.** Don't run a counter that ticks upward — browsers freeze timers in
> background tabs, and a page refresh wipes it. Instead store *when you started* and display
> `now − start`. Look at the wall clock; don't count sheep. And because "now" comes from a
> laptop clock that may be minutes off, sync against the server's clock once on load — the same
> clock that stamped `started_at`, so the two can't disagree.

- **Start** — insert with `started_at = now()`. The partial unique index makes a second start
  a `409`; the client then offers "resume the live one" or "stop it and start new".
- **Pause** — `paused_at = now()`. **Resume** — `paused_ms += now() - paused_at`, clear `paused_at`.
- **Elapsed** — one shared pure function, `lib/time/elapsed.ts`, used by *both* the ticking
  client display and server-side aggregation. Never two implementations:
  ```
  elapsedMs = (endedAt ?? now) - startedAt - pausedMs - (pausedAt ? now - pausedAt : 0)
  ```
- **Display** — `setInterval` at 250ms **recomputing from `startedAt`**, never incrementing a
  counter. Refresh-safe and drift-free by construction.
- **Clock skew** — capture `serverOffset = serverNow - clientNow` once on load and apply it to
  every client-side `now`. A user with a wrong system clock otherwise sees garbage.
- **Heartbeat + reaper** — client PATCHes `last_heartbeat_at` every 60s while running. A Vercel
  Cron job every 15 min closes any live session whose heartbeat is >30 min stale, setting
  `ended_at = last_heartbeat_at` and `end_reason = 'auto_closed'`. **This is the single thing
  that most often ruins DIY trackers** — close the laptop, wake up to a 14-hour session, and
  every downstream statistic is poisoned.

  > **In plain English.** A session stays "running" until you press Finish — and sometimes you
  > never do (laptop closed, browser crashed, walked away). The heartbeat is the browser saying
  > "still here" once a minute; the reaper is a server job that notices when those stop and
  > closes the session **at the last heartbeat**, not at the time it noticed. Study 20:00–21:30,
  > close the lid, and you get a correct 90-minute session instead of 13 hours of fiction.
  > Nothing looks broken without this — the charts still render, they're just lying.
- **Idle-return prompt** — on `visibilitychange` back to visible after >10 min hidden: "still
  focusing?" → keep / trim to blur time / discard.
- **Finish** → opens the session-note sheet. Note optional; Esc saves without it.
- **Pomodoro** reuses the same row: client drives the cycle, PATCHing `break_ms` and
  `completed_cycles` on each work→break transition. Break time shows separately and never
  counts as focus.
- **Manual entry + inline edit** on the session log, for time you forgot to track. Without this
  people abandon trackers the first time they forget to hit start.

---

## Analytics

**The non-obvious part:** hour-of-day analysis requires **splitting sessions across hour
boundaries**. A 21:30→23:00 session is 30 min in hour 21 and 60 min in hour 22. Bucketing by
`started_at` alone badly skews "when do I focus best" — which is your headline question.

`features/analytics/lib/split.ts` → `splitSessionIntoHourBuckets(session, tz)`. Same treatment
for day buckets, offset by `day_start_hour`. Do it in TypeScript server-side, not SQL — a few
thousand rows is nothing, and it stays testable. **Unit tests required** for: DST transitions,
sessions crossing midnight, sessions crossing the day-start boundary, paused sessions.

v1 metric set:

1. **KPI row** — total focus, sessions, avg length, best day (range-aware)
2. **Focus by track** — share of time, donut + bar
3. **Contribution heatmap** — GitHub-style year grid by daily minutes
4. **Hour-of-day profile** — the headline chart, with a plain-language callout: *"Your peak
   focus window is 21:00–23:00."*
5. **Trend** — daily/weekly minutes with a 7-day rolling average
6. **Session length distribution** — histogram; reveals many-short vs few-long
7. **Consistency** — % of days in range with a session; current + longest streak
8. **Goal progress** — per-track weekly target rings, daily goal ring
9. **Task stats** — completed vs created, on-time vs late, open by priority

Insight callouts in plain language ("you focus 2.3× longer in the evening than the morning")
are cheap to compute and are the actual point of the page — charts alone make you do the work.

---

## Routes

```
/sign-in
/dashboard          today · live timer · goal rings · today's tasks · upcoming deadlines · mini heatmap
/tracks             grid with totals + weekly goal rings
/tracks/[id]        session history, notes timeline, track-scoped analytics
/focus              fullscreen distraction-free timer
/sessions           full log — filter, inline edit, manual add, export
/tasks              today / upcoming / someday / done
/calendar           month · week · agenda of deadlines (toggle: overlay session blocks)
/analytics
/settings           timezone, day-start hour, goals, pomodoro defaults, export
```

## Structure — feature-first

```
src/
  app/
    (auth)/sign-in/page.tsx
    (app)/layout.tsx              # shell: sidebar, persistent timer bar, providers
    (app)/{dashboard,tracks,focus,sessions,tasks,calendar,analytics,settings}/
    api/auth/[...nextauth]/route.ts
    api/cron/reap-sessions/route.ts
  features/
    tracks/     { components/, server/{queries,actions}.ts, schema.ts, hooks/ }
    sessions/   { components/, server/, hooks/use-timer.ts, machine.ts, schema.ts }
    tasks/      { ... }
    calendar/   { components/, lib/ }
    analytics/  { components/, lib/{split,metrics,insights}.ts }
    settings/
  components/{ui,motion,layout}/
  db/{schema/,index.ts,migrations/}
  lib/{auth.ts,time/,validation/,utils.ts}
```

**One structural rule:** `features/*/server/` is the only code that touches `db`. Everything
else imports from a feature. This is what keeps it from becoming spaghetti at ~15 routes.

## Motion

- `components/motion/variants.ts` — one shared set of easings and durations, so the app feels
  like one system rather than each component inventing its own animation.
- `LayoutGroup` + `layoutId` to morph the timer between the mini bar and fullscreen focus mode.
  This is the best animation in the app; budget real time for it.
- `AnimatePresence` for sheets, route transitions, task list add/remove.
- **`useReducedMotion` respected everywhere** — non-negotiable.
- Animate containers, not 200 list children. And do **not** spring-animate the ticking digits —
  use `tabular-nums` and animate only on state change.

---

## Build order

**Phase 0 — Foundation.** `create-next-app` (TS, Tailwind v4, App Router) → shadcn init → run
`uipro` in project root → Neon project with `dev`/`main` branches → Drizzle schema + first
migration → Auth.js Google + allowlist + protected layout → app shell with providers.
*Done when:* you log in with Google and see an empty shell.

**Phase 1 — Tracks + Timer.** Track CRUD with color/icon. Timer engine, `elapsed.ts`,
clock-skew correction, partial unique index. Persistent mini timer bar. Session-note sheet on
finish. Session log with inline edit + manual entry.
*Done when:* you can track real study time and see it listed.

**Phase 2 — Focus mode + Pomodoro.** `/focus` fullscreen with the `layoutId` morph. Pomodoro
cycles and break accounting. Heartbeat, cron reaper, idle-return prompt.
*Done when:* the screenshot-2 experience works and the data stays honest.

**Phase 3 — Tasks + Calendar.** Task CRUD, due dates, priority, optional track link.
Today/Upcoming/Done. Month/week/agenda deadline calendar. Sync columns present, unused.
*Done when:* to-dos with deadlines render on a calendar.

**Phase 4 — Analytics + Goals.** `split.ts` + `metrics.ts` with tests. All charts + insight
callouts. Weekly track targets, daily goal, streaks with day-start offset.
*Done when:* the app tells you your peak focus window.

**Phase 5 — Polish + deploy.** Motion pass, empty states, skeletons, mobile responsive, PWA
manifest. Vercel + Neon `main`, cron configured. JSON/CSV export.
*Done when:* it's usable from your phone.

**v1.1 — Google Calendar.** Add the calendar scope to the existing grant, dedicated secondary
calendar, `syncToken` incremental pull, push webhook, last-write-wins conflicts.

---

## Deliberately out of scope

Cut from the reference: XP / levels / ranks / badges, mood tracking, background themes & shop,
music player, social + online-user counts, premium gating. Gamification chrome competes with
the data for attention, and this is a tool for one person who is already motivated.

**Habits** is the interesting cut — it overlaps confusingly with both tracks and tasks. Daily
goal + streaks covers most of the same need. Revisit in v2 only if it doesn't.

---

## Verification

**Automated**
- Unit tests: `lib/time/elapsed.ts` (paused, live, ended, skewed clock) and
  `features/analytics/lib/split.ts` (DST transition, midnight crossing, day-start boundary).
  These two files are where silent wrongness lives.
- Optional Playwright smoke test: start → pause → resume → finish → assert logged duration.

**Manual — the checks that actually matter**
1. Start a timer, hard-refresh mid-session → elapsed is unchanged and still ticking.
2. Pause 2 min, resume, finish → total excludes the pause.
3. Start a session in a second tab → 409, offered "resume existing".
4. Set `last_heartbeat_at` back 40 min in Drizzle Studio, hit `/api/cron/reap-sessions` → session
   closes at the heartbeat time with `end_reason = 'auto_closed'`.
5. Set timezone to one with DST, log a session across the transition → analytics don't gain or
   lose an hour.
6. Set `day_start_hour = 4`, log a session at 01:00 → it counts toward the previous day and
   doesn't break the streak.

**Seed script — do this in Phase 0, not Phase 4.** `npm run db:seed` generating ~90 days of
realistic synthetic sessions (clustered evenings, occasional gaps, varied lengths). Building
analytics against three real data points produces charts that look fine and are wrong.

`npx drizzle-kit studio` for inspecting data throughout.
