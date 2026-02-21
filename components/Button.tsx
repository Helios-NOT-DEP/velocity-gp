import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "green" | "outline" | "ghost";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  cyan: [
    "bg-electric-cyan text-navy-bg font-bold",
    "hover:bg-electric-cyan/90 hover:shadow-cyan",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "border border-electric-cyan",
  ].join(" "),
  green: [
    "bg-neon-green text-navy-bg font-bold",
    "hover:bg-neon-green/90 hover:shadow-green",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "border border-neon-green",
  ].join(" "),
  outline: [
    "bg-transparent text-electric-cyan font-semibold",
    "border border-electric-cyan/60",
    "hover:bg-electric-cyan/10 hover:border-electric-cyan",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),
  ghost: [
    "bg-transparent text-slate-text font-semibold",
    "hover:text-white hover:bg-navy-surface",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "cyan", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "rounded-lg px-5 py-3 text-sm transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy-bg",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
