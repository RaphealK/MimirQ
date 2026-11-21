import * as React from "react";

import { cn } from "@/lib/utils";

export type StatStripTone = "default" | "success" | "warning" | "danger";

export type StatStripItem = {
  id?: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  /** @deprecated Use detail. Kept for SystemDataStrip compatibility. */
  hint?: React.ReactNode;
  tone?: StatStripTone;
  mono?: boolean;
};

type StatStripProps = {
  items: readonly StatStripItem[];
  className?: string;
  /** Engineering rule: a viewport shows at most five aggregates. */
  max?: number;
  /** Minimum cell width; narrow viewports scroll the single row horizontally. */
  minColumnWidth?: number;
};

const TONE_CLASS: Record<StatStripTone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

/**
 * Single-row metric strip. It replaces parallel stat cards; counts must not be
 * repeated elsewhere in the same viewport.
 */
export function StatStrip({
  items,
  className,
  max = 5,
  minColumnWidth = 140,
}: Readonly<StatStripProps>) {
  if (!items.length) return null;

  const visibleItems = items.slice(0, Math.max(1, Math.min(max, 5)));
  const cellWidth = Math.max(140, Math.floor(minColumnWidth));

  return (
    <dl
      data-slot="stat-strip"
      className={cn("stat-strip", className)}
      style={
        { "--stat-strip-min-width": `${cellWidth}px` } as React.CSSProperties
      }
    >
      {visibleItems.map((item, index) => (
        <div
          key={item.id || `${item.label}-${index}`}
          className="stat-strip__item"
        >
          <dt className="stat-strip__label">{item.label}</dt>
          <dd
            className={cn(
              "stat-strip__value",
              item.mono && "font-mono",
              TONE_CLASS[item.tone ?? "default"],
            )}
            title={typeof item.value === "string" ? item.value : undefined}
          >
            {item.value}
          </dd>
          {(item.detail ?? item.hint) ? (
            <div className="stat-strip__detail">{item.detail ?? item.hint}</div>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** @deprecated Use StatStrip. Kept as a compatibility alias. */
export const SystemDataStrip = StatStrip;
/** @deprecated Use StatStripItem. */
export type SystemDataStripItem = StatStripItem;
