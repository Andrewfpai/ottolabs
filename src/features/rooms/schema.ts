import { z } from "zod";

export const roomNameSchema = z
  .string()
  .trim()
  .min(1, "Give the room a name")
  .max(60, "Keep the name under 60 characters");

export const createRoomSchema = z.object({ name: roomNameSchema });
export const renameRoomSchema = z.object({ roomId: z.uuid(), name: roomNameSchema });
export const roomIdSchema = z.object({ roomId: z.uuid() });
export const roomMemberSchema = z.object({ roomId: z.uuid(), userId: z.string().min(1).max(100) });
