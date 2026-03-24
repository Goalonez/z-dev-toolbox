import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib";

type ButtonVariant = "default" | "secondary" | "ghost" | "outline";
type ButtonSize = "default" | "sm" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClassMap: Record<ButtonVariant, string> = {
  default:
    "border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.97),rgb(var(--color-surface-strong)/0.94))] text-foreground shadow-[0_14px_28px_-24px_rgb(var(--color-shadow-ambient)/0.26)] hover:-translate-y-0.5 hover:border-accent/16 hover:bg-surfaceStrong/98 hover:shadow-[0_18px_32px_-24px_rgb(var(--color-shadow-ambient)/0.32),0_8px_20px_-18px_rgb(var(--color-shadow-warm)/0.16)] disabled:border-border/60 disabled:bg-background/40 disabled:text-muted",
  secondary:
    "border border-[rgb(var(--color-border)/var(--control-border-alpha))] bg-[linear-gradient(180deg,rgb(var(--color-surface)/0.97),rgb(var(--color-surface-strong)/0.94))] text-foreground shadow-[0_14px_28px_-24px_rgb(var(--color-shadow-ambient)/0.26)] hover:-translate-y-0.5 hover:border-accent/16 hover:bg-surfaceStrong/98 hover:shadow-[0_18px_32px_-24px_rgb(var(--color-shadow-ambient)/0.32),0_8px_20px_-18px_rgb(var(--color-shadow-warm)/0.16)] disabled:border-border/60 disabled:bg-background/40 disabled:text-muted",
  ghost:
    "border border-[rgb(var(--color-border)/calc(var(--control-border-alpha)-0.06))] bg-[linear-gradient(180deg,rgb(var(--color-background)/0.78),rgb(var(--color-surface)/0.84))] text-muted shadow-[0_10px_22px_-24px_rgb(var(--color-shadow-ambient)/0.24)] hover:-translate-y-0.5 hover:border-accent/14 hover:bg-accentSoft/28 hover:text-foreground hover:shadow-[0_16px_28px_-24px_rgb(var(--color-shadow-ambient)/0.3),0_8px_18px_-18px_rgb(var(--color-shadow-warm)/0.12)] disabled:border-border/50 disabled:bg-background/28 disabled:text-muted/70",
  outline:
    "border border-[rgb(var(--color-border)/calc(var(--control-border-alpha)-0.04))] bg-[linear-gradient(180deg,rgb(var(--color-background)/0.82),rgb(var(--color-surface)/0.88))] text-foreground shadow-[0_12px_24px_-26px_rgb(var(--color-shadow-ambient)/0.24)] hover:border-accent/16 hover:bg-surface/92 hover:shadow-[0_16px_28px_-24px_rgb(var(--color-shadow-ambient)/0.28)] disabled:border-border/60 disabled:bg-background/32 disabled:text-muted"
};

const sizeClassMap: Record<ButtonSize, string> = {
  default: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
  icon: "h-10 w-10 p-0 text-sm"
};

export const Button = ({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-medium leading-none transition-[background-color,border-color,color,box-shadow,transform]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/22 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:shadow-none",
      variantClassMap[variant],
      sizeClassMap[size],
      className,
    )}
    type={type}
    {...props}
  />
);
