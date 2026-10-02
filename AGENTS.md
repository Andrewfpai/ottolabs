<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OttoLabs — project rules

A personal learning-time tracker. See `README.md` for setup and architecture.

## Non-negotiables

1. **Never compute elapsed time anywhere but `src/lib/time/elapsed.ts`.** Both
   the ticking client display and every server aggregation call it. Two
   implementations means the app disagrees with itself.
2. **Never store or increment a running duration counter.** Sessions store
   timestamps; duration is always derived. This is what makes the timer
   refresh-safe and immune to background-tab throttling.
3. **On the client, use `clock.now()` from `src/lib/time/clock.ts`, not
   `Date.now()`.** It applies the measured server offset.
4. **`focus_sessions` is never shortened to `sessions`.** Auth.js owns that name.
5. **`breakMs` is a subset of `pausedMs`.** Never subtract both.
6. **Every Server Action calls `requireUser()` itself.** They are reachable by
   direct POST, so a protected layout is not protection.
7. **Only `features/*/server/` imports `db`.**
8. **`sql<T>` is a cast, not a parser.** Drizzle's `sql<Date>` only changes the
   TypeScript type; the driver still returns whatever it returns. Aggregates
   over timestamps come back as **strings**, and `sum()` / `extract()` come back
   as strings too. Use `.mapWith(someColumn)` for dates, an explicit `::int` for
   counts, or wrap in `Number()` — and type the field honestly as `string` if
   that is what arrives.
9. **Postgres errors hide under `error.cause`.** Drizzle wraps them in a
   `DrizzleQueryError`, so checking `error.code` directly never matches. Use the
   helpers in `lib/action-result.ts`, which walk the cause chain.
10. **Track colours are token names ("teal"), never hex.** See
   `src/lib/track-colors.ts`; Tailwind cannot see dynamic class names, so
   classes are spelled out there in full.
11. **A pomodoro break is a pause with `break_started_at` set.** That flag is
   the only thing separating a break from a manual pause when the pause is
   closed by resume, finish or the reaper — all three must bank the stretch
   into `break_ms` *and* `paused_ms`. Aggregates subtract `paused_ms` only.
12. **Pomodoro transitions fire only while the tab is visible.** Auto-pausing a
   hidden tab deletes focus time that was genuinely earned elsewhere;
   auto-resuming one credits time spent away from the desk. Let the phase run
   over instead — `pomodoroPhase` reports overrun honestly.
13. **The heartbeat, the pomodoro engine and idle detection mount once**, in
   `TimerBar`. It stays mounted on `/focus`, where only the visible bar stands
   down. Two copies race to make the same transition.

## UI

- Orange (`cta`) is reserved for Start and nothing else.
- Any number that updates in place gets `.font-numeric` (tabular figures) so it
  does not reflow as it ticks.
- Respect `useReducedMotion` in every Motion component.
- Icon-only buttons need `aria-label`; clickable elements need `cursor-pointer`.

## Verification

`npm run typecheck && npm run lint && npm run test` before calling anything done.
