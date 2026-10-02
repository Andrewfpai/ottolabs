"use client";

import { Check, ImagePlus } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBackground, useCustomPictureUrl } from "@/features/focus/components/focus-background";
import { FocusScene } from "@/features/focus/components/scenes";
import { MAX_CUSTOM_BYTES, saveCustomPicture, SCENES, writeBackground } from "@/features/focus/lib/background";
import { cn } from "@/lib/utils";

/** Choose focus mode's backdrop: a built-in scene or your own picture. */
export function BackgroundPicker({
  open,
  onOpenChange,
  version,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bumped after an upload so every preview reloads the picture. */
  version: number;
  onUploaded: () => void;
}) {
  const current = useBackground();
  const picture = useCustomPictureUrl(open, version);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file.");
      return;
    }
    if (file.size > MAX_CUSTOM_BYTES) {
      toast.error("That picture is over 15 MB. Try a smaller one.");
      return;
    }
    try {
      await saveCustomPicture(file);
      writeBackground("custom");
      onUploaded();
      toast.success("Background set. It stays on this device.");
    } catch {
      toast.error("This browser would not save the picture. Private mode can block it.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Background</SheetTitle>
          <SheetDescription>Scenes are drawn live and gently animated. Your own picture stays on this device.</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 px-4 pb-6">
          {SCENES.map((scene) => (
            <Choice
              key={scene.id}
              label={scene.label}
              selected={current === scene.id}
              onClick={() => writeBackground(scene.id)}
            >
              <FocusScene id={scene.id} className="absolute inset-0 size-full" />
            </Choice>
          ))}

          <Choice
            label={picture ? "Your picture" : "Upload a picture"}
            selected={current === "custom"}
            onClick={() => (picture ? writeBackground("custom") : input.current?.click())}
          >
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob URL
              <img src={picture} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs">
                <ImagePlus className="size-5" aria-hidden />
                JPG, PNG or WebP
              </span>
            )}
          </Choice>

          {picture ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="text-muted-foreground hover:text-foreground col-span-2 cursor-pointer text-left text-xs underline underline-offset-4"
            >
              Replace your picture
            </button>
          ) : null}

          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-label="Upload a background picture"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Choice({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group cursor-pointer space-y-1.5 text-left"
    >
      <span
        className={cn(
          "bg-muted relative block aspect-video overflow-hidden rounded-lg ring-2 ring-transparent transition-shadow",
          selected ? "ring-primary" : "group-hover:ring-border",
        )}
      >
        {children}
        {selected ? (
          <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
            <Check className="size-3" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="block text-sm font-medium">{label}</span>
    </button>
  );
}
