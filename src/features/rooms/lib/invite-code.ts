/**
 * Room invite codes: the secret in `/rooms/join/<code>`. Pure, so what a
 * pasted link turns into is tested.
 */
export const ROOM_CODE_PATTERN = /^[A-Za-z0-9_-]{12}$/;

/**
 * A code from whatever was pasted: the full link, a link with stray spaces
 * or a trailing slash, or the bare code. Null when there is none.
 */
export function parseRoomCode(input: string): string | null {
  const value = input.trim().replace(/\/+$/, "");
  const fromLink = value.match(/\/rooms\/join\/([A-Za-z0-9_-]+)(?:[?#].*)?$/);
  const code = fromLink ? fromLink[1] : value;
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

export function roomInvitePath(code: string): string {
  return `/rooms/join/${code}`;
}
