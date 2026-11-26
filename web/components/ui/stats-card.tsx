"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  unit?: string;
  dot?: "success" | "warning" | "destructive" | "info" | "pulse";
  dim?: boolean;
  onClick?: () => void;
  active?: boolean;
  color?:
    | "amber"
    | "blue"
    | "green"
    | "teal"
    | "orange"
    | "red"
    | "gray"
    | "cyan"
    | "sky"
    | "rose"
    | "indigo";
  className?: string;
  dense?: boolean;
}

const dotStyles: Record<NonNullable<StatCardProps["dot"]>, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-danger",
  info: "bg-subtle-foreground",
  pulse: "bg-subtle-foreground animate-pulse",
};

const valueColorStyles: Record<NonNullable<StatCardProps["color"]>, string> = {
  amber: "text-warning",
  blue: "text-foreground",
  green: "text-success",
  teal: "text-foreground",
  orange: "text-warning",
  red: "text-danger",
  gray: "text-foreground",
  cyan: "text-foreground",
  sky: "text-foreground",
  rose: "text-danger",
  indigo: "text-foreground",
};

const iconTextStyles: Record<NonNullable<StatCardProps["color"]>, string> = {
  amber: "text-warning",
  blue: "text-muted-foreground",
  green: "text-success",
  teal: "text-muted-foreground",
  orange: "text-warning",
  red: "text-danger",
  gray: "text-muted-foreground",
  cyan: "text-muted-foreground",
  sky: "text-muted-foreground",
  rose: "text-danger",
  indigo: "text-muted-foreground",
};

const colorStyles = {
  amber:
    "border-warning/25 bg-surface text-warning group-hover:border-warning/40 group-hover:bg-warning/[0.06]",
  blue: "border-border bg-surface text-foreground group-hover:border-border-strong group-hover:bg-raised",
  green:
    "border-success/25 bg-surface text-success group-hover:border-success/40 group-hover:bg-success/[0.06]",
  teal: "border-border bg-surface text-foreground group-hover:border-border-strong group-hover:bg-raised",
  orange:
    "border-warning/25 bg-surface text-warning group-hover:border-warning/40 group-hover:bg-warning/[0.05]",
  red: "border-danger/25 bg-surface text-danger group-hover:border-danger/40 group-hover:bg-danger/[0.05]",
  gray: "border-border bg-surface text-foreground group-hover:border-border-strong group-hover:bg-raised",
  cyan: "border-border bg-surface text-foreground group-hover:border-border-strong group-hover:bg-raised",
  sky: "border-border bg-surface text-foreground group-hover:border-border-strong group-hover:bg-raised",
  rose: "border-danger/25 bg-surface text-danger group-hover:border-danger/40 group-hover:bg-danger/[0.05]",
  indigo:
    "border-border bg-surface text-foreground group-hover:border-border-strong group-hover:bg-raised",
};

const iconBgStyles = {
  amber: "border border-warning/25 bg-warning/[0.08] text-warning",
  blue: "border border-border bg-raised text-muted-foreground",
  green: "border border-success/25 bg-success/[0.08] text-success",
  teal: "border border-border bg-raised text-muted-foreground",
  orange: "border border-warning/25 bg-warning/[0.07] text-warning",
  red: "border border-danger/25 bg-danger/[0.07] text-danger",
  gray: "border border-border bg-raised text-muted-foreground",
  cyan: "border border-border bg-raised text-muted-foreground",
  sky: "border border-border bg-raised text-muted-foreground",
  rose: "border border-danger/25 bg-danger/[0.07] text-danger",
  indigo: "border border-border bg-raised text-muted-foreground",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  unit,
  dot,
  dim,
  onClick,
  active = false,
  color = "sky",
  className,
  dense = false,
  variant = "default",
}: Readonly<StatCardProps & { variant?: "default" | "minimal" }>) {
  const isZeroValue =
    value === 0 ||
    value === "0" ||
    value === "0 Bytes" ||
    value === "" ||
    value == null;
  const isDimmed = dim ?? isZeroValue;

  if (variant === "minimal") {
    const Wrapper = onClick ? "button" : "div";
    const statusColorStyle = isDimmed
      ? "bg-raised text-muted-foreground border-border"
      : active
        ? "bg-raised text-foreground border-border-strong"
        : (colorStyles[color] || colorStyles.sky) + " border-border";

    return (
      <Wrapper
        onClick={onClick}
        type={onClick ? "button" : undefined}
        className={cn(
          "inline-flex items-center gap-2.5 h-9 px-3 rounded-md group/stat transition-colors duration-120 text-left whitespace-nowrap border bg-surface",
          onClick &&
            "cursor-pointer hover:border-border-strong hover:bg-raised",
          statusColorStyle,
          className,
        )}
      >
        <div
          className={cn(
            "relative flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
            isDimmed
              ? "border border-border bg-raised text-subtle-foreground"
              : active
                ? "border border-border bg-raised text-foreground"
                : iconBgStyles[color] || iconBgStyles.sky,
          )}
        >
          <Icon className="size-4" />
          {dot && !isDimmed && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 inline-block size-2 rounded-full ring-2 ring-background shadow-sm",
                dotStyles[dot],
              )}
            />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase opacity-70 leading-none mb-0.5">
            {label}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "text-[14px] font-black font-mono tabular-nums leading-none transition-all duration-200",
                isDimmed ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {value}
            </span>
            {unit && (
              <span
                className={cn(
                  "text-[9px] font-bold uppercase transition-opacity duration-200",
                  isDimmed ? "opacity-40" : "opacity-60",
                )}
              >
                {unit}
              </span>
            )}
          </div>
        </div>
      </Wrapper>
    );
  }

  const silentColorStyle = "border-border bg-raised text-muted-foreground";
  const silentIconStyle =
    "border border-border bg-raised text-subtle-foreground";

  if (dense) {
    return (
      <div
        className={cn(
          "group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-none transition-colors duration-200 hover:border-border-strong hover:bg-raised",
          isDimmed ? silentColorStyle : colorStyles[color] || colorStyles.sky,
          className,
        )}
      >
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
            isDimmed
              ? silentIconStyle
              : iconBgStyles[color] || iconBgStyles.sky,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "truncate text-[14px] font-mono font-black tabular-nums transition-all duration-200",
              isDimmed ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {value}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-none hover:border-border-strong",
        isDimmed ? silentColorStyle : colorStyles[color] || colorStyles.sky,
        className,
      )}
    >
      <div
        className={cn(
          "relative flex size-12 items-center justify-center rounded-lg p-3 transition-colors duration-200",
          isDimmed ? silentIconStyle : iconBgStyles[color] || iconBgStyles.sky,
        )}
      >
        <Icon className="size-6" />
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="truncate text-[11px] font-black uppercase mb-1 text-muted-foreground">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "truncate text-[24px] font-mono font-black leading-none transition-all duration-200",
              isDimmed ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {value}
          </p>
          {unit && (
            <span className="text-xs font-bold uppercase text-muted-foreground transition-all duration-200">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatsGrid({
  children,
  className,
  dense = false,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  dense?: boolean;
}>) {
  return (
    <div
      className={cn(
        dense
          ? "grid grid-cols-1 gap-2 md:gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          : "grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
