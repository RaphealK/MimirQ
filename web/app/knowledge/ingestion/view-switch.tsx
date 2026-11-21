"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

type IngestionView =
  | "operation"
  | "parsing"
  | "governance"
  | "chunk-preview"
  | "execution-monitor";

type IngestionViewSwitchProps = {
  className?: string;
  compact?: boolean;
  tone?: "default" | "info";
};

const VIEW_OPTIONS: Array<{
  value: IngestionView;
  label: string;
  route?: string;
}> = [
  { value: "operation", label: "新建任务" },
  { value: "parsing", label: "文档解析", route: "/parsing" },
  { value: "governance", label: "数据治理", route: "/data-governance" },
  { value: "chunk-preview", label: "切块预览", route: "/chunk-preview" },
  { value: "execution-monitor", label: "任务监控" },
];

function resolveActiveView(
  pathname: string,
  mode: string | null,
): IngestionView {
  if (mode === "execution-monitor") return "execution-monitor";
  if (pathname.endsWith("/parsing")) return "parsing";
  if (pathname.endsWith("/data-governance")) return "governance";
  if (pathname.endsWith("/chunk-preview")) return "chunk-preview";
  return "operation";
}

export function IngestionViewSwitch({
  className,
  compact = false,
  tone = "default",
}: Readonly<IngestionViewSwitchProps>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const activeView = resolveActiveView(pathname, searchParams.get("mode"));

  const handleChangeView = useCallback(
    (nextView: IngestionView) => {
      if (nextView === "operation" || nextView === "execution-monitor") {
        const params = new URLSearchParams(searchParams.toString());
        if (nextView === "execution-monitor") {
          params.set("mode", "execution-monitor");
        } else {
          params.delete("mode");
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
        return;
      }

      const option = VIEW_OPTIONS.find((item) => item.value === nextView);
      if (!option?.route) return;
      const datasetId =
        searchParams.get("datasetId") || searchParams.get("dataset_id") || "";
      const params = new URLSearchParams();
      if (datasetId) params.set("dataset_id", datasetId);
      const query = params.toString();
      router.push(query ? `${option.route}?${query}` : option.route);
    },
    [pathname, router, searchParams],
  );

  return (
    <div
      role="tablist"
      aria-label="入库流程视图"
      className={cn(
        "flex w-full items-center gap-1 overflow-x-auto",
        className,
      )}
    >
      {VIEW_OPTIONS.map((option) => {
        const selected = activeView === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-current={selected ? "page" : undefined}
            onClick={() => handleChangeView(option.value)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8",
              selected
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
              compact && "px-2.5",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
