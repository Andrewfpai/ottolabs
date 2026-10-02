import { sql } from "drizzle-orm";

import { users } from "@/db/schema";

/**
 * A user's picture as one string: `animal:<id>~<accessories>` when they picked an animal,
 * else their photo URL. The SQL twin of `pictureFor` in `lib/avatars.ts`;
 * an unknown id is caught where it is drawn and falls back to initials.
 */
export const userPicture = sql<string | null>`case
  when ${users.avatar} is null then ${users.image}
  when cardinality(${users.accessories}) = 0 then 'animal:' || ${users.avatar}
  else 'animal:' || ${users.avatar} || '~' || array_to_string(${users.accessories}, ',')
end`;
