import type { HTMLAttributes } from "react";

import { cn } from "../lib";

export const Badge = ({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-border/20 bg-surfaceStrong/88 px-2.5 py-1 text-[11px] font-medium tracking-[0.01em] text-muted",
      className,
    )}
    {...props}
  />
);
