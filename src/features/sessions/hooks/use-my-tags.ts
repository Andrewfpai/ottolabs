"use client";

import { useQuery } from "@tanstack/react-query";

import { getMyTags } from "@/features/sessions/server/actions";

export const MY_TAGS_KEY = ["session", "tags"] as const;

/** Your tags for suggestions, fetched only once a tagging field is on screen. */
export function useMyTags(enabled: boolean): string[] {
  const { data } = useQuery({
    queryKey: MY_TAGS_KEY,
    queryFn: () => getMyTags(),
    enabled,
    staleTime: 5 * 60_000,
  });
  return data ?? [];
}
