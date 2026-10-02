/**
 * Return type for Server Actions.
 *
 * Actions return failures rather than throwing them. A thrown error in a Server
 * Action reaches the client as an opaque "an error occurred" in production,
 * which is useless for things the user can actually fix — a duplicate track
 * name, a timer already running. Genuine bugs still throw.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: string, code?: string): ActionResult<T> {
  return { ok: false, error, code };
}

/**
 * Find the underlying Postgres error.
 *
 * Drizzle wraps driver errors in a `DrizzleQueryError` and hangs the real one
 * off `cause`, so checking `error.code` on what you caught finds nothing and
 * every constraint violation falls through to the generic error path. Walking
 * the chain is what makes "you already have a track with that name" reachable
 * instead of a 500.
 */
function pgError(error: unknown): { code?: string; constraint?: string } | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === "object" && current !== null && "code" in current) {
      const code = (current as { code?: unknown }).code;
      // Postgres SQLSTATEs are five characters; Node system errors put things
      // like "ECONNRESET" in the same field.
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
        return current as { code?: string; constraint?: string };
      }
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null;
  }

  return null;
}

function hasCode(error: unknown, code: string): boolean {
  return pgError(error)?.code === code;
}

/** Postgres unique-violation. */
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, "23505");
}

/** Postgres foreign-key violation — e.g. deleting a track that has sessions. */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasCode(error, "23503");
}

/** Postgres invalid_parameter_value — e.g. a time zone name it does not know. */
export function isInvalidParameterValue(error: unknown): boolean {
  return hasCode(error, "22023");
}

/** The name of the index a constraint violation came from. */
export function violatedConstraint(error: unknown): string | null {
  return pgError(error)?.constraint ?? null;
}
