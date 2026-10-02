"use client";

import { useSyncExternalStore } from "react";

// Never fires: the value can only change once, at hydration, and React already
// re-renders then. Returning a no-op unsubscribe satisfies the store contract.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * True once the client has hydrated, false during server render and the first
 * client pass.
 *
 * Use this instead of the `useState(false)` + `useEffect(() => setMounted(true))`
 * idiom: that pattern schedules a cascading render and trips the React Compiler
 * lint rule, whereas `useSyncExternalStore` is the sanctioned way to read a
 * value that legitimately differs between server and client.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
