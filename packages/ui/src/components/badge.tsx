import type { HTMLAttributes } from "react";

import { cn } from "../lib";

export const Badge = ({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-border/80 bg-surfaceStrong/90 px-2.5 py-1 text-xs font-medium text-muted",
      className,
    )}
    {...props}
  />
);
