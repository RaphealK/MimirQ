import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 items-center rounded-md border border-transparent px-2 text-micro font-medium transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default: "bg-raised text-muted-foreground",
        secondary: "bg-raised text-muted-foreground",
        destructive: "bg-danger/12 text-danger",
        success: "bg-success/12 text-success",
        warning: "bg-warning/12 text-warning",
        /* Informational is neutral: no fourth hue. */
        info: "bg-raised text-muted-foreground",
        soft: "bg-raised text-subtle-foreground",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: Readonly<BadgeProps>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
