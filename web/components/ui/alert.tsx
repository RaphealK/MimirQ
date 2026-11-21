import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import type { RadixRef } from "@/lib/radix-utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground/80",
  {
    variants: {
      variant: {
        default: "bg-surface text-foreground border-border",
        success:
          "bg-success/10 border-success/30 text-foreground [&>svg]:text-success",
        warning:
          "bg-warning/10 border-warning/30 text-foreground [&>svg]:text-warning",
        info: "bg-surface border-border text-foreground [&>svg]:text-foreground",
        destructive:
          "bg-danger/10 border-danger/30 text-foreground [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AlertProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  function Alert({ className, variant, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      />
    );
  },
);

export const AlertTitle = React.forwardRef<
  RadixRef<"h5">,
  React.ComponentPropsWithoutRef<"h5">
>(function AlertTitle({ className, children, ...props }, ref) {
  return (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none", className)}
      {...props}
    >
      {children}
    </h5>
  );
});

export const AlertDescription = React.forwardRef<
  RadixRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function AlertDescription({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "text-compact leading-relaxed text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
