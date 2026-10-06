import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, SITE_BUTTON_CLASS } from "../../lib/utils";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
};

export function ActionButton({
  children,
  className,
  variant = "primary",
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={cn(
        "inline-flex min-h-11 items-center justify-center font-display text-xl uppercase tracking-normal transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-primary px-6 text-primary-foreground hover:bg-primary/85",
        variant === "outline" && "border border-border bg-card/40 px-6 text-foreground hover:border-primary hover:text-primary",
        variant === "ghost" && "px-3 text-muted-foreground hover:text-foreground",
        className,
        SITE_BUTTON_CLASS,
      )}
      {...props}
    >
      {children}
    </button>
  );
}