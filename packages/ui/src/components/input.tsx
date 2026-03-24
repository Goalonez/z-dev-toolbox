import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "../lib";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-2xl border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.98),rgb(var(--color-surface-strong)/0.94))] px-4 text-sm text-foreground shadow-[0_14px_26px_-26px_rgb(var(--color-shadow-ambient)/0.28)] outline-none transition-[background-color,border-color,color,box-shadow,transform]",
        "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
        "placeholder:text-muted/72 hover:border-accent/16 hover:bg-surfaceStrong/96 focus:border-accent/26 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_4px_rgb(var(--color-accent)/0.08),0_18px_34px_-24px_rgb(var(--color-shadow-ambient)/0.42)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-background/40 disabled:text-muted/72",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
