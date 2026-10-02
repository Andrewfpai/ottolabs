import { sql } from "drizzle-orm";

import { users } from "@/db/schema";

/**
 * A user's picture as one string: `animal:<id>` when they picked an animal,
 * else their photo URL. The SQL twin of `pictureFor` in `lib/avatars.ts`;
 * an unknown id is caught where it is drawn and falls back to initials.
 */
export const userPicture = sql<string | null>`case when ${users.avatar} is not null then 'animal:' || ${users.avatar} else ${users.image} end`;
