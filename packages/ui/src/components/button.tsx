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
    "border border-[rgb(var(--color-foreground)/0.14)] bg-foreground text-background shadow-[0_20px_36px_-24px_rgb(var(--color-shadow-ambient)/0.5)] hover:border-[rgb(var(--color-foreground)/0.18)] hover:bg-[rgb(var(--color-foreground)/0.94)] hover:shadow-[0_22px_38px_-24px_rgb(var(--color-shadow-ambient)/0.56)] active:translate-y-px disabled:border-transparent disabled:bg-foreground/14 disabled:text-muted",
  secondary:
    "border border-[rgb(var(--color-border)/0.28)] bg-[rgb(var(--color-surface)/0.9)] text-foreground shadow-[0_10px_20px_-20px_rgb(var(--color-shadow-ambient)/0.24)] hover:border-[rgb(var(--color-border)/0.44)] hover:bg-surfaceStrong/94 hover:shadow-[0_12px_22px_-22px_rgb(var(--color-shadow-ambient)/0.28)] active:translate-y-px disabled:border-border/22 disabled:bg-background/44 disabled:text-muted/76",
  ghost:
    "border border-transparent bg-transparent text-muted shadow-none hover:bg-surfaceStrong/82 hover:text-foreground active:translate-y-px disabled:text-muted/62",
  outline:
    "border border-[rgb(var(--color-border)/0.24)] bg-[rgb(var(--color-surface)/0.66)] text-foreground shadow-none hover:border-[rgb(var(--color-border)/0.46)] hover:bg-surfaceStrong/88 active:translate-y-px disabled:border-border/18 disabled:bg-background/30 disabled:text-muted/72"
};

const sizeClassMap: Record<ButtonSize, string> = {
  default: "h-10 px-4.5 text-sm",
  sm: "h-9 px-3.5 text-sm",
  icon: "h-9 w-9 p-0 text-sm"
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
      "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-medium leading-none tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform]",
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
