"use client";

import { AtSign } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeUsername, USERNAME_MAX, usernameSchema } from "@/features/friends/lib/username";
import { setUsername } from "@/features/friends/server/actions";

export function UsernameForm({ current, suggestion }: { current: string | null; suggestion: string }) {
  const [value, setValue] = useState(current ?? suggestion);
  const [saved, setSaved] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unchanged = normalizeUsername(value) === saved;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const check = usernameSchema.safeParse(value);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "That username will not work.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setUsername({ username: check.data });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(result.data);
      setValue(result.data);
      toast.success(`You are @${result.data}.`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="username">{saved ? "Your username" : "Pick a username"}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 sm:max-w-xs">
          <AtSign
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id="username"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            maxLength={USERNAME_MAX + 1}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby="username-help"
            className="pl-8"
          />
        </div>
        <Button
          type="submit"
          className="cursor-pointer"
          disabled={pending || unchanged || !value.trim()}
          aria-busy={pending}
        >
          {pending ? "Saving…" : saved ? "Change" : "Save"}
        </Button>
      </div>
      {error ? (
        <p role="alert" id="username-help" className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        <p id="username-help" className="text-muted-foreground text-xs">
          3–20 letters, numbers or underscores. Friends type it to add you, so they never need your
          email.
        </p>
      )}
    </form>
  );
}
