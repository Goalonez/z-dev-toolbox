import type { HTMLAttributes } from "react";

import { cn } from "../lib";

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-[28px] border border-[rgb(var(--color-border)/var(--panel-shell-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.985),rgb(var(--color-surface-strong)/0.95))] shadow-panel backdrop-blur-[22px]",
      "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_top_left,rgb(var(--color-panel-glow)/calc(var(--panel-glow-alpha)*1.6)),transparent_42%),radial-gradient(circle_at_top_right,rgb(var(--color-accent)/0.08),transparent_30%),linear-gradient(180deg,rgb(var(--color-panel-glow)/var(--panel-shell-sheen-alpha)),transparent_18%)] before:content-['']",
      "after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[27px] after:border after:border-[rgb(var(--color-panel-glow)/var(--panel-shell-outline-alpha))] after:content-['']",
      className,
    )}
    {...props}
  />
);

export const CardHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-1.5 p-5", className)} {...props} />
);

export const CardTitle = ({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-semibold text-foreground", className)} {...props} />
);

export const CardDescription = ({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted", className)} {...props} />
);

export const CardContent = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5 pt-0", className)} {...props} />
);
