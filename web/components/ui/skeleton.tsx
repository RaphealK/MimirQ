import * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-lg bg-raised", className)}
      {...props}
    />
  );
}

export { Skeleton };
