import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
  children?: React.ReactNode;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  iconClassName,
  className,
  children,
}: Readonly<EmptyStateProps>) {
  return (
    <section
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center border border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-5 grid size-12 place-items-center border border-border bg-muted">
          <Icon className={cn("size-6 text-muted-foreground", iconClassName)} />
        </div>
      ) : null}

      <h2 className="text-title-sm font-semibold text-foreground">{title}</h2>
      {description ? (
        <div className="mt-1.5 max-w-md text-body text-muted-foreground">
          {description}
        </div>
      ) : null}

      {children ? (
        <div className="mt-5 flex items-center gap-2.5">{children}</div>
      ) : null}
    </section>
  );
}
