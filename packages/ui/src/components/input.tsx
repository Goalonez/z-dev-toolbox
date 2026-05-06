import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "../lib";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full appearance-none rounded-[14px] border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[rgb(var(--color-surface)/0.96)] px-3.5 text-sm text-foreground shadow-[0_1px_2px_rgb(var(--color-shadow-ambient)/0.04)] outline-none transition-[background-color,border-color,color,box-shadow]",
        "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
        "placeholder:text-muted/78 hover:border-border/52 hover:bg-surface focus:border-accent/66 focus:outline-none focus:ring-0 focus:shadow-[0_0_0_3px_rgb(var(--color-accent)/0.14)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:border-border/22 disabled:bg-background/56 disabled:text-muted/72",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
