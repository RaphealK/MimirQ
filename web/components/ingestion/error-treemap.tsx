"use client";

import { cn } from "@/lib/utils";

export function ErrorTreemap({
  data,
  selectedReason,
  onReasonSelect,
}: Readonly<{
  data: Array<{
    name: string;
    count: number;
    fill: string;
    formatLabel: string;
    timeLabel: string;
  }>;
  selectedReason: string | null;
  onReasonSelect: (reason: string) => void;
}>) {
  return (
    <div
      aria-label="风险重灾区热力图"
      role="grid"
      className="grid auto-rows-fr gap-2 sm:grid-cols-2 lg:grid-cols-3"
    >
      {data.map((payload) => {
        const isActive = payload.name === selectedReason;
        return (
          <button
            key={payload.name}
            type="button"
            role="gridcell"
            aria-selected={isActive}
            onClick={() => onReasonSelect(payload.name)}
            className={cn(
              "group relative h-full overflow-hidden rounded-[4px] border border-border p-0 text-left transition-colors duration-120 hover:border-border-strong",
              isActive && "border-foreground ring-1 ring-inset ring-foreground",
            )}
            style={{
              background: payload.fill,
            }}
          >
            <div className="flex h-full min-h-[74px] flex-col justify-between rounded-[4px] px-2.5 py-2.5 text-foreground">
              <div className="relative z-10 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-subtle-foreground">
                    <span className="truncate text-micro uppercase tracking-[0.14em]">
                      {payload.formatLabel}
                    </span>
                    <div className="h-1.5 w-px bg-border" />
                    <span className="truncate text-micro uppercase tracking-[0.12em]">
                      {payload.timeLabel}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-caption font-medium leading-[1.28] text-foreground">
                    {payload.name}
                  </div>
                </div>
                <div className="shrink-0 font-code text-body font-semibold leading-none tabular-nums text-foreground">
                  {payload.count}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
