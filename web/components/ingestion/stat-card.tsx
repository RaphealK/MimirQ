"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  buildSparklinePath,
  buildSparklinePlaceholderPath,
} from "./monitor-utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  delta = null,
  deltaInverted = false,
  sparklineMode,
  sparklineValues = [],
}: Readonly<{
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  iconSurface: string;
  border: string;
  delta?: number | null;
  deltaInverted?: boolean;
  pulse?: boolean;
  ringColor?: string;
  sparklineMode: "real" | "placeholder";
  sparklineValues?: number[];
  sparklineColor?: string;
}>) {
  const deltaBad = deltaInverted
    ? delta !== null && delta > 0
    : delta !== null && delta < 0;
  const deltaGood = delta !== null && !deltaBad && delta !== 0;
  const pathData =
    sparklineMode === "placeholder"
      ? buildSparklinePlaceholderPath()
      : buildSparklinePath(sparklineValues);

  return (
    <div className="group flex items-center gap-2.5 rounded-[4px] border border-border bg-surface px-2.5 py-1.5 transition-colors duration-120 hover:bg-muted/40 motion-reduce:transition-none">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted">
        <Icon className="size-3.5 text-foreground" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <div className="flex items-center gap-1 text-micro font-bold uppercase text-subtle-foreground">
          <span className="truncate">{label}</span>
          {delta !== null && (
            <span
              className={cn(
                "font-black tabular-nums",
                deltaGood ? "text-success" : "text-destructive",
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>
        <div className="text-compact font-bold tabular-nums text-foreground">
          {value}
        </div>
      </div>
      <svg
        viewBox="0 0 80 24"
        aria-hidden="true"
        className="ml-auto h-6 w-20 shrink-0 overflow-visible"
      >
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={sparklineMode === "placeholder" ? "4 3" : undefined}
          className="text-muted-foreground"
        />
      </svg>
    </div>
  );
}
