import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "bg-transparent hover:bg-[hsl(var(--bp-accent))]",
        subtle:
          "bg-[hsl(var(--bp-muted))] text-[hsl(var(--bp-muted-foreground))] hover:bg-[hsl(var(--bp-accent))]"
      },
      size: {
        sm: "h-8 px-3",
        icon: "h-8 w-8"
      }
    },
    defaultVariants: {
      variant: "ghost",
      size: "sm"
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => (
    <button className={cn(buttonVariants({ size, variant }), className)} ref={ref} {...props} />
  )
);

Button.displayName = "Button";

