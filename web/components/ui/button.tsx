import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-compact font-medium ring-offset-background transition-[background-color,border-color,color,opacity] duration-120 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        /* Primary is the foreground-inverse pair: white on dark, ink on light. */
        default:
          "bg-primary text-primary-foreground hover:opacity-[0.88] active:bg-primary-pressed",
        destructive:
          "border border-danger bg-transparent text-danger hover:bg-danger/12 active:bg-danger/18",
        /* Status variants are neutral controls; hue is reserved for indicators. */
        success:
          "border border-border bg-transparent text-foreground hover:bg-raised",
        warning:
          "border border-border bg-transparent text-foreground hover:bg-raised",
        info: "border border-border bg-transparent text-foreground hover:bg-raised",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-raised active:bg-raised",
        secondary:
          "border border-border bg-transparent text-foreground hover:bg-raised active:bg-raised",
        ghost:
          "border-0 bg-transparent text-muted-foreground hover:bg-raised hover:text-foreground active:bg-raised active:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-3 pointer-fine:sm:h-8",
        sm: "h-11 px-3 pointer-fine:sm:h-7",
        lg: "h-11 px-3 pointer-fine:sm:h-9",
        icon: "size-11 pointer-fine:sm:size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = Readonly<
  React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>;

function normalizeAccessibleLabel(
  value: string | undefined,
): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      title,
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const iconAccessibleLabel =
      size === "icon"
        ? (normalizeAccessibleLabel(ariaLabel) ??
          normalizeAccessibleLabel(title))
        : undefined;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        title={size === "icon" ? (title ?? iconAccessibleLabel) : title}
        aria-label={iconAccessibleLabel ?? ariaLabel}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
