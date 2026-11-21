/**
 * 顶栏：当前位置、命令搜索与后端依赖状态。
 *
 * 顶栏固定 48px；窄屏控件保持 44px 触控目标。
 * 只承载全局定位与既有动作，任务入口仍由全局 TaskCenter 独占。
 */
"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { getNavigationBreadcrumb } from "@/components/navbar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useBackendMetaDetails } from "@/hooks/use-backend-meta";
import { useBackendReady } from "@/hooks/use-backend-ready";
import { useTenantAccess } from "@/hooks/use-tenant-access";
import { Link, usePathname } from "@/i18n/navigation";
import {
  TENANT_PERMISSIONS,
  tenantAccessAllows,
} from "@/lib/tenant-permissions";
import { cn } from "@/lib/utils";
import { useCommandMenuState } from "@/store/command-menu";

function trimmedPrimitiveString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value).trim();
  }
  return "";
}

function formatDepStatus(status: unknown): {
  label: string;
  className: string;
} {
  const label = trimmedPrimitiveString(status) || "unknown";
  const lower = label.toLowerCase();
  if (lower === "connected" || lower === "ready") {
    return { label, className: "text-success" };
  }
  if (
    lower === "disabled" ||
    lower === "not_configured" ||
    lower === "unknown"
  ) {
    return { label, className: "text-muted-foreground" };
  }
  return { label, className: "text-destructive" };
}

function resolveBackendState(ok: boolean | null) {
  if (ok === true) {
    return {
      badge: "completed" as const,
      label: "OK",
      className: "text-success",
    };
  }
  if (ok === false) {
    return {
      badge: "failed" as const,
      label: "Down",
      className: "text-destructive",
    };
  }
  return {
    badge: "processing" as const,
    label: "...",
    className: "text-muted-foreground",
  };
}

export function AppFrameTopbar() {
  const t = useTranslations("Navbar");
  const pathname = usePathname();
  const commandMenuOpen = useCommandMenuState((state) => state.open);
  const setCommandMenuOpen = useCommandMenuState((state) => state.setOpen);
  const { isDevMode } = useAuth();
  const { data: backendMeta } = useBackendMetaDetails();
  const backendReady = useBackendReady();
  const tenantAccess = useTenantAccess();
  // Match the rail guard: client-cached tenant access must not change the
  // first render. Apply it (and dev-mode navigation) only after hydration.
  const [hasHydratedNavigationAccess, setHasHydratedNavigationAccess] =
    useState(false);

  useEffect(() => {
    setHasHydratedNavigationAccess(true);
  }, []);

  const breadcrumb = getNavigationBreadcrumb(pathname);
  const readyDetails = backendReady.data ?? null;
  const backendOk = (() => {
    if (typeof readyDetails?.ok === "boolean") return readyDetails.ok;
    if (backendReady.isError) return false;
    return null;
  })();
  const backendState = resolveBackendState(backendOk);
  const lastReadyAt =
    Math.max(
      backendReady.dataUpdatedAt || 0,
      backendReady.errorUpdatedAt || 0,
    ) || null;
  const checkedAtLabel = lastReadyAt
    ? new Date(lastReadyAt).toLocaleTimeString()
    : "—";
  const authMode = String(backendMeta?.features?.auth_mode || "");
  const vectorBackend = String(
    backendMeta?.features?.vector_backend ||
      readyDetails?.vector?.backend ||
      "",
  );
  const buildSha = String(backendMeta?.build?.sha || "");
  const buildShaShort = buildSha ? buildSha.slice(0, 8) : "";
  const navigationTenantAccess = hasHydratedNavigationAccess
    ? tenantAccess.data
    : undefined;
  const allowDevNavigation = hasHydratedNavigationAccess && isDevMode;
  const canOpenDiagnostics =
    allowDevNavigation ||
    tenantAccessAllows(
      navigationTenantAccess,
      TENANT_PERMISSIONS.OBSERVABILITY_READ,
    );

  const depRows: Array<{
    key: string;
    status: unknown;
    note?: string;
    error?: unknown;
  }> = readyDetails
    ? [
        {
          key: "DB",
          status: readyDetails.database?.status,
          error: readyDetails.database?.error,
        },
        {
          key: `Vector (${String(readyDetails.vector?.backend || vectorBackend || "-")})`,
          status: readyDetails.vector?.status,
          error: readyDetails.vector?.error,
        },
        {
          key: "Redis",
          status: readyDetails.redis?.status,
          note: (() => {
            const redis = readyDetails.redis;
            if (!redis) return undefined;
            if (!redis.enabled) return "disabled";
            const required = Boolean(redis.required);
            const cache = Boolean(redis.embedding_cache_enabled);
            return `${required ? "required" : "optional"}${cache ? ", cache" : ""}`;
          })(),
          error: readyDetails.redis?.error,
        },
        {
          key: "MinIO",
          status: readyDetails.minio?.status,
          note: (() => {
            const minio = readyDetails.minio;
            if (!minio) return undefined;
            if (!minio.enabled) return "disabled";
            return minio.bucket ? `bucket: ${minio.bucket}` : undefined;
          })(),
          error: readyDetails.minio?.error,
        },
      ]
    : [];

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-2 pl-[52px] md:gap-3 md:px-4 md:pl-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-caption text-muted-foreground">
        {breadcrumb ? (
          <>
            <span className="hidden shrink-0 sm:inline">
              {t(breadcrumb.sectionTitleKey)}
            </span>
            <ChevronRight
              className="hidden size-3 shrink-0 sm:inline"
              aria-hidden="true"
            />
            <span className="truncate font-medium text-foreground">
              {t(breadcrumb.itemLabelKey)}
            </span>
          </>
        ) : (
          <span className="truncate font-medium text-foreground">MimirQ</span>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCommandMenuOpen(true)}
          aria-label={t("command.triggerLabel")}
          aria-haspopup="dialog"
          aria-expanded={commandMenuOpen}
          aria-controls="mimirq-command-menu"
          title={t("command.triggerLabel")}
          className="flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[2px] border border-border bg-background px-0 text-left text-compact text-muted-foreground transition-colors hover:border-info/40 hover:bg-info/5 focus-ring sm:w-auto sm:max-w-xs sm:justify-start sm:px-2.5 md:h-8"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden truncate sm:inline">
            {t("command.triggerLabel")}
          </span>
          <span className="ml-auto hidden shrink-0 border border-border bg-muted px-1.5 py-0.5 text-micro font-medium text-muted-foreground lg:inline">
            ⌘K
          </span>
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 items-center rounded-[2px] px-1 focus-ring md:min-h-8"
              aria-label={t("deps.openStatus")}
              title={t("deps.openStatus")}
            >
              <StatusBadge
                status={backendState.badge}
                label={`Deps：${backendState.label}`}
                dense
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-80">
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{t("deps.ready")}</p>
                <span className={cn("font-medium", backendState.className)}>
                  {backendState.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-micro text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Auth</span>
                  <span className="text-foreground">{authMode || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Vector</span>
                  <span className="text-foreground">
                    {vectorBackend || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Build</span>
                  <span className="text-foreground">
                    {buildShaShort || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Checked</span>
                  <span className="text-foreground">{checkedAtLabel}</span>
                </div>
              </div>

              <div className="rounded-[2px] border border-border bg-background p-2.5">
                {readyDetails ? (
                  <div className="space-y-2">
                    {depRows.map((row) => {
                      const status = formatDepStatus(row.status);
                      const errText = trimmedPrimitiveString(row.error);
                      return (
                        <div key={row.key} className="space-y-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-foreground">
                              {row.key}
                            </span>
                            <span
                              className={cn("font-medium", status.className)}
                            >
                              {status.label}
                            </span>
                          </div>
                          {row.note ? (
                            <div className="text-micro text-muted-foreground">
                              {row.note}
                            </div>
                          ) : null}
                          {errText ? (
                            <div
                              className="max-w-[260px] truncate text-micro text-muted-foreground"
                              title={errText}
                            >
                              {errText}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-micro text-muted-foreground">
                    {t("deps.unavailable")}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                {canOpenDiagnostics ? (
                  <Link
                    href="/diagnostics"
                    className="text-micro text-info hover:underline"
                  >
                    {t("deps.diagnosticsLink")}
                  </Link>
                ) : (
                  <span className="text-micro text-muted-foreground">
                    仅管理员可查看诊断
                  </span>
                )}
                <span className="text-micro text-muted-foreground">
                  {t("deps.requestIdHint")}
                </span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
