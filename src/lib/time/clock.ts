/**
 * Server-corrected clock for the browser.
 *
 * Elapsed time is `now - startedAt`, where `startedAt` was stamped by the
 * server. If the browser's own clock disagrees with the server's — which is
 * common: dead CMOS battery, dual-boot, a timezone that never synced — that
 * subtraction is wrong by the size of the disagreement, and the timer reads
 * something absurd the moment you press Start.
 *
 * So we measure the offset once on load and apply it everywhere. Both sides of
 * the subtraction then come from the same clock, and cannot disagree.
 */

let offsetMs = 0;
let synced = false;

/**
 * Record the offset from a server time reading, correcting for the round trip.
 *
 * We assume the request and response legs take about the same time, so the
 * server's instant lines up with the midpoint of our own send/receive pair.
 * That leaves an error of roughly half the latency asymmetry — a few tens of
 * milliseconds at worst, which is irrelevant next to the clock errors this
 * exists to cancel out.
 */
export function recordServerTime(
  serverNowMs: number,
  sentAtMs: number,
  receivedAtMs: number = Date.now(),
): void {
  const clientMidpoint = sentAtMs + (receivedAtMs - sentAtMs) / 2;
  offsetMs = serverNowMs - clientMidpoint;
  synced = true;
}

/** Current time in epoch ms, on the server's clock. Use instead of Date.now(). */
export function now(): number {
  return Date.now() + offsetMs;
}

export function getOffsetMs(): number {
  return offsetMs;
}

export function isSynced(): boolean {
  return synced;
}

/** Fetch server time and record the offset. Safe to call more than once. */
export async function syncClock(signal?: AbortSignal): Promise<void> {
  const sentAt = Date.now();
  const res = await fetch("/api/time", { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Clock sync failed: ${res.status}`);
  const { now: serverNow } = (await res.json()) as { now: number };
  recordServerTime(serverNow, sentAt);
}

/** Test seam. */
export function __setOffsetForTests(ms: number): void {
  offsetMs = ms;
  synced = true;
}
