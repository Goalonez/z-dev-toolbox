import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "../lib";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-52 w-full appearance-none rounded-[26px] border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-surface-strong)/0.94))] px-4 py-4 text-sm text-foreground shadow-[0_14px_26px_-26px_rgb(var(--color-shadow-ambient)/0.28)] outline-none transition-[background-color,border-color,color,box-shadow]",
      "placeholder:text-muted/72 hover:border-accent/16 hover:bg-surfaceStrong/96 focus:border-accent/26 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_4px_rgb(var(--color-accent)/0.08),0_18px_34px_-24px_rgb(var(--color-shadow-ambient)/0.42)] focus-visible:outline-none focus-visible:ring-0",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
