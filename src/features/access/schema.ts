import { z } from "zod";

/** Lowercased before validation, matching what the table's check constraint demands. */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email address is too long")
    .pipe(z.email("Enter a valid email address")),
});

export type InviteInput = z.input<typeof inviteSchema>;
