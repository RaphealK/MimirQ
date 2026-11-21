"use client";

/**
 * KnowledgeRetrievalPanel - Index Audit Module
 * 优化版：极致高密度诊断台、UI Pro Max 物理质感、极客化数据展示
 */
import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  Database,
  FileStack,
  Fingerprint,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  HardDrive,
  Layers3,
  Scan,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useIndexAudit } from "@/hooks/use-index-audit";
import { cn, detachPromise } from "@/lib/utils";

type KnowledgeRetrievalPanelProps = {
  selectedDatasetId?: string;
  selectedDocumentIds?: string[];
  compact?: boolean;
  aggregateDocuments?: number;
  aggregateChunks?: number;
};

function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = getCompactByteDigits(value);
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function getCompactByteDigits(value: number): number {
  if (value >= 100) return 0;
  if (value >= 10) return 1;
  return 2;
}

function getChecklistStateLabel(state: string): string {
  if (state === "ok") return "正常";
  if (state === "warning") return "关注";
  if (state === "compat") return "兼容";
  if (state === "unknown") return "未知";
  return "等待";
}

function getDetailsButtonLabel({
  hasIndexDetails,
  detailsExpanded,
  selectedDatasetId,
  indexAuditLoading,
}: {
  hasIndexDetails: boolean;
  detailsExpanded: boolean;
  selectedDatasetId?: string;
  indexAuditLoading: boolean;
}): string {
  if (hasIndexDetails) {
    return detailsExpanded ? "收起索引详情" : "查看索引详情";
  }
  if (!selectedDatasetId) return "选择数据集后查看详情";
  if (indexAuditLoading) return "审计运行中";
  return "运行审计查看详情";
}

// Backend currently doesn't expose index storage directly.
// Use a stable rough estimate so the card aligns with the design
// without pretending the number is exact.
function estimateIndexSizeBytes(vectorCount: number): number {
  const normalizedCount = Math.max(0, Math.trunc(vectorCount || 0));
  const embeddingDims = 3072;
  const bytesPerDim = 4;
  const storageOverheadMultiplier = 2.2;
  return Math.round(
    normalizedCount * embeddingDims * bytesPerDim * storageOverheadMultiplier,
  );
}

export function KnowledgeRetrievalPanel({
  selectedDatasetId,
  selectedDocumentIds = [],
  compact = false,
  aggregateDocuments = 0,
  aggregateChunks = 0,
}: Readonly<KnowledgeRetrievalPanelProps>) {
  const t = useTranslations("KnowledgeRetrievalPanel");
  // t("empty.title")
  // t("empty.description")
  const {
    indexAudit,
    indexAuditError,
    indexAuditHasDocumentScope,
    indexAuditLoading,
    indexAuditReconcileState,
    reconcileIndexAudit,
    runIndexAudit,
  } = useIndexAudit({ selectedDatasetId, selectedDocumentIds });
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const hasAggregateOverview =
    !selectedDatasetId && (aggregateDocuments > 0 || aggregateChunks > 0);
  const overviewDatasetLabel = selectedDatasetId || "全部数据集";

  const channelRows = useMemo(() => {
    const summary = indexAudit?.index_channels;
    if (!summary) return [];

    const countsByChannel = summary.status_counts_by_channel ?? {};
    const legacyByChannel = summary.legacy_by_channel ?? {};
    const preferredOrder = [
      "vector",
      "bm25",
      "kg",
      "event_vector",
      "entity_vector",
    ];
    const channels = [
      ...preferredOrder.filter((channel) => channel in countsByChannel),
      ...Object.keys(countsByChannel)
        .filter((channel) => !preferredOrder.includes(channel))
        .sort(),
    ];

    return channels.map((channel) => {
      const counts = countsByChannel[channel] ?? {};
      const rowCount = Object.values(counts).reduce(
        (total, value) => total + Math.max(0, Number(value || 0)),
        0,
      );
      const errorCount = Math.max(0, Number(counts.error || 0));
      const nonTerminalCount = Object.entries(counts).reduce(
        (total, [status, value]) =>
          ["ready", "disabled", "skipped", "error"].includes(status)
            ? total
            : total + Math.max(0, Number(value || 0)),
        0,
      );
      const legacyCount = Math.max(0, Number(legacyByChannel[channel] || 0));
      const unknown = rowCount === 0;
      const state = errorCount
        ? "warning"
        : nonTerminalCount
          ? "pending"
          : legacyCount
            ? "compat"
            : unknown
              ? "unknown"
              : "ok";
      const statusParts = Object.entries(counts)
        .filter(([, count]) => Number(count || 0) > 0)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([status, count]) => `${status} ${count}`);
      if (legacyCount > 0) statusParts.push(`legacy ${legacyCount}`);

      return {
        channel,
        detail:
          legacyCount > 0
            ? `${legacyCount} 个文档使用兼容推断状态（无持久化通道行）`
            : null,
        readinessLabel:
          state === "warning"
            ? "Error"
            : state === "pending"
              ? "Pending"
              : state === "compat"
                ? "Compatibility"
                : state === "unknown"
                  ? "Unknown"
                  : "Ready",
        rowCount,
        state,
        statusLabel:
          state === "compat"
            ? `兼容 / ${statusParts.join(" · ")}`
            : statusParts.join(" · ") || "unknown",
        summaryKind:
          state === "compat"
            ? "compat"
            : state === "unknown"
              ? "unknown"
              : state === "ok"
                ? "ready"
                : "other",
      };
    });
  }, [indexAudit?.index_channels]);

  const channelSummary = useMemo(
    () =>
      channelRows.reduce(
        (acc, row) => {
          if (row.summaryKind === "ready") acc.ready += 1;
          else if (row.summaryKind === "compat") acc.compat += 1;
          else if (row.summaryKind === "unknown") acc.unknown += 1;
          else if (row.state === "warning") acc.warning += 1;
          else acc.pending += 1;
          return acc;
        },
        { ready: 0, compat: 0, unknown: 0, warning: 0, pending: 0 },
      ),
    [channelRows],
  );

  const metricCards = useMemo(() => {
    if (indexAudit) {
      return [
        {
          key: "checkedIds",
          label: "向量总数",
          value: indexAudit.vector_ids_checked.toLocaleString(),
          icon: Fingerprint,
          tone: "emerald",
          meta: "索引向量",
          estimated: false,
        },
        {
          key: "activeDocuments",
          label: "文档总数",
          value: indexAudit.active_documents.toLocaleString(),
          icon: FileStack,
          tone: "blue",
          meta: "入库文档",
          estimated: false,
        },
        {
          key: "activeChunks",
          label: "分片总数",
          value: indexAudit.active_chunks.toLocaleString(),
          icon: Layers3,
          tone: "violet",
          meta: "检索分片",
          estimated: false,
        },
        {
          key: "indexSize",
          label: "索引大小",
          value: formatBytesCompact(
            estimateIndexSizeBytes(indexAudit.vector_ids_checked),
          ),
          icon: HardDrive,
          tone: "sky",
          meta: indexAudit.vector_backend || "向量后端",
          estimated: true,
        },
      ];
    }

    if (hasAggregateOverview) {
      return [
        {
          key: "checkedIds",
          label: "向量总数",
          value: aggregateChunks.toLocaleString(),
          icon: Fingerprint,
          tone: "emerald",
          meta: "全量向量",
          estimated: false,
        },
        {
          key: "activeDocuments",
          label: "文档总数",
          value: aggregateDocuments.toLocaleString(),
          icon: FileStack,
          tone: "blue",
          meta: "全部数据集",
          estimated: false,
        },
        {
          key: "activeChunks",
          label: "分片总数",
          value: aggregateChunks.toLocaleString(),
          icon: Layers3,
          tone: "violet",
          meta: "全量分片",
          estimated: false,
        },
        {
          key: "indexSize",
          label: "索引大小",
          value: formatBytesCompact(estimateIndexSizeBytes(aggregateChunks)),
          icon: HardDrive,
          tone: "sky",
          meta: "全量估算",
          estimated: true,
        },
      ];
    }

    return [];
  }, [aggregateChunks, aggregateDocuments, hasAggregateOverview, indexAudit]);

  const auditStatus = useMemo(() => {
    if (hasAggregateOverview) {
      return { label: "聚合数据（未审计）", tone: "neutral" as const };
    }
    if (!selectedDatasetId) {
      return { label: "等待选择数据集", tone: "warning" as const };
    }
    if (indexAuditLoading) {
      return { label: "审计运行中", tone: "info" as const };
    }
    if (indexAuditError) {
      return { label: "审计异常", tone: "danger" as const };
    }
    if (indexAudit) {
      const channels = indexAudit.index_channels;
      if (!channels) {
        return { label: "通道状态未知", tone: "warning" as const };
      }
      if ((channels.required_error_documents ?? 0) > 0) {
        return { label: "发现索引错误", tone: "danger" as const };
      }
      if ((channels.required_pending_documents ?? 0) > 0) {
        return { label: "索引同步中", tone: "warning" as const };
      }
      if ((channels.documents_using_legacy_fallback ?? 0) > 0) {
        return { label: "兼容状态（待迁移）", tone: "warning" as const };
      }
      if (indexAudit.active_documents === 0) {
        return { label: "无可审计文档", tone: "neutral" as const };
      }
      return { label: "正常运行", tone: "success" as const };
    }
    return { label: "待执行审计", tone: "neutral" as const };
  }, [
    hasAggregateOverview,
    indexAudit,
    indexAuditError,
    indexAuditLoading,
    selectedDatasetId,
  ]);

  const healthChecklist = useMemo(() => {
    if (hasAggregateOverview) {
      return [
        { label: "索引服务", state: "unknown" },
        { label: "向量服务", state: "unknown" },
        { label: "存储服务", state: "unknown" },
        { label: "权限校验", state: "unknown" },
      ] as const;
    }
    if (!indexAudit) {
      return [
        { label: "索引服务", state: "pending" },
        { label: "向量服务", state: "pending" },
        { label: "存储服务", state: "pending" },
        { label: "权限校验", state: "pending" },
      ];
    }

    if (channelRows.length > 0) {
      return channelRows.map((row) => ({
        label: row.channel,
        state: row.state,
      }));
    }

    return [
      {
        label: "索引服务",
        state: indexAudit.vector_ids_missing_in_backend > 0 ? "warning" : "ok",
      },
      {
        label: "向量服务",
        state: indexAudit.vector_id_missing > 0 ? "warning" : "ok",
      },
      {
        label: "存储服务",
        state:
          (indexAudit.milvus_orphan_ids_sample || []).length > 0
            ? "warning"
            : "ok",
      },
      { label: "权限校验", state: "unknown" },
    ] as const;
  }, [channelRows, hasAggregateOverview, indexAudit]);

  const hasIndexDetails = Boolean(indexAudit || hasAggregateOverview);
  const detailsButtonLabel = getDetailsButtonLabel({
    hasIndexDetails,
    detailsExpanded,
    selectedDatasetId,
    indexAuditLoading,
  });
  const indexDetailRows = useMemo(() => {
    if (indexAudit) {
      return [
        ["向量后端", indexAudit.vector_backend || "—"],
        ["已检查向量", indexAudit.vector_ids_checked.toLocaleString()],
        ["入库文档", indexAudit.active_documents.toLocaleString()],
        ["检索分片", indexAudit.active_chunks.toLocaleString()],
        ["DB 缺失 vector_id", String(indexAudit.vector_id_missing ?? 0)],
        ["后端缺失向量", String(indexAudit.vector_ids_missing_in_backend ?? 0)],
        [
          "孤儿向量样本",
          String(indexAudit.milvus_orphan_ids_sample?.length ?? 0),
        ],
        [
          "估算索引大小",
          formatBytesCompact(
            estimateIndexSizeBytes(indexAudit.vector_ids_checked),
          ),
        ],
      ];
    }

    if (hasAggregateOverview) {
      return [
        ["审计范围", "全部数据集聚合"],
        ["文档总数", aggregateDocuments.toLocaleString()],
        ["分片总数", aggregateChunks.toLocaleString()],
        [
          "估算索引大小",
          formatBytesCompact(estimateIndexSizeBytes(aggregateChunks)),
        ],
      ];
    }

    return [];
  }, [aggregateChunks, aggregateDocuments, hasAggregateOverview, indexAudit]);

  const statusToneClassName = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
    info: "bg-muted text-foreground border-border",
    neutral: "bg-muted/30 text-muted-foreground border-border",
  }[auditStatus.tone];

  const renderDiagnosticHeader = () => (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-[6px] border transition-colors",
            indexAuditLoading
              ? "border-border-strong bg-raised"
              : "border-border bg-muted/30",
          )}
        >
          {indexAuditLoading ? (
            <Scan className="size-5 text-foreground" />
          ) : (
            <ShieldCheck className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-micro font-medium uppercase tracking-[0.2em] text-subtle-foreground leading-none">
              {t("header.badge")}
            </span>
            <div
              className={cn(
                "size-1 rounded-full",
                selectedDatasetId ? "bg-success" : "bg-muted-foreground/20",
              )}
            />
          </div>
          <h4 className="mt-1 text-compact font-medium text-foreground">
            {t("header.title")}
          </h4>
        </div>
      </div>

      <Button
        type="button"
        variant={indexAuditLoading ? "secondary" : "outline"}
        className={cn(
          "px-4 text-micro font-medium uppercase",
          indexAuditLoading && "border-foreground/30 text-foreground",
        )}
        onClick={() => detachPromise(runIndexAudit())}
        disabled={!selectedDatasetId || indexAuditLoading}
      >
        {indexAuditLoading ? (
          <Loader2 className="mr-2 size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 size-3.5" />
        )}
        {indexAuditLoading ? t("actions.running") : t("actions.run")}
      </Button>
    </div>
  );

  const renderChannelStatusSummary = () => {
    if (!indexAudit) return null;

    return (
      <div className="space-y-3 border-t border-border pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-compact font-medium text-foreground">
            通道 readiness
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-micro">
            <span className="rounded-[4px] border border-success/20 bg-success/10 px-2 py-0.5 text-success">
              ready {channelSummary.ready}
            </span>
            <span className="rounded-[4px] border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-destructive">
              error {channelSummary.warning}
            </span>
            <span className="rounded-[4px] border border-border bg-muted px-2 py-0.5 text-foreground">
              pending {channelSummary.pending}
            </span>
            <span className="rounded-[4px] border border-warning/20 bg-warning/10 px-2 py-0.5 text-warning">
              compat {channelSummary.compat}
            </span>
            <span className="rounded-[4px] border border-border bg-muted/30 px-2 py-0.5 text-muted-foreground">
              unknown {channelSummary.unknown}
            </span>
          </div>
        </div>
        {channelRows.length > 0 ? (
          <div className="space-y-2">
            {channelRows.map((row) => (
              <div
                key={row.channel}
                className="rounded-[6px] border border-border bg-surface px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-caption font-medium text-foreground" title={row.channel}>
                      {row.channel}
                    </div>
                    <div className="mt-1 text-micro text-subtle-foreground">
                      {row.statusLabel}
                      {typeof row.rowCount === "number"
                        ? ` · rows ${row.rowCount}`
                        : ""}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-[4px] px-2.5 py-1 text-micro font-medium",
                      row.state === "ok" && "bg-success/10 text-success",
                      (row.state === "warning" || row.state === "compat") &&
                        "bg-warning/10 text-warning",
                      row.state === "unknown" &&
                        "bg-muted/30 text-muted-foreground",
                      row.state === "pending" && "bg-muted text-foreground",
                    )}
                  >
                    {row.readinessLabel}
                  </span>
                </div>
                {row.detail ? (
                  <div className="mt-1 text-micro text-subtle-foreground">
                    {row.detail}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[6px] border border-border bg-surface px-3 py-2 text-micro text-subtle-foreground">
            后端未返回 `index_channels`，保持兼容展示。
          </div>
        )}
      </div>
    );
  };

  const renderReconcileAction = () => {
    if (!indexAuditHasDocumentScope) return null;

    const loading = indexAuditReconcileState.status === "loading";
    return (
      <div className="space-y-3 border-t border-border pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-compact font-medium text-foreground">
              Document-scoped reconcile
            </div>
            <div className="mt-1 text-micro text-subtle-foreground">
              仅对当前文档范围提交修复任务；dataset-only 不支持。
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 pointer-coarse:min-w-11 rounded-[4px] border-border bg-surface px-4 text-caption font-medium uppercase pointer-fine:sm:h-8"
            onClick={() => detachPromise(reconcileIndexAudit())}
            disabled={loading || !selectedDatasetId}
          >
            {loading ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <AlertCircle className="mr-2 size-3.5" />
            )}
            {loading ? "提交中" : "Reconcile"}
          </Button>
        </div>
        {indexAuditReconcileState.status !== "idle" ? (
          <div
            className={cn(
              "rounded-[6px] border px-3 py-2 text-micro",
              indexAuditReconcileState.status === "success" &&
                "border-success/20 bg-success/10 text-success",
              indexAuditReconcileState.status === "error" &&
                "border-destructive/20 bg-destructive/10 text-destructive",
              indexAuditReconcileState.status === "loading" &&
                "border-border bg-muted text-foreground",
            )}
          >
            {indexAuditReconcileState.message}
            {indexAuditReconcileState.backendStatus ? (
              <span className="ml-2 font-mono opacity-75">
                [{indexAuditReconcileState.backendStatus}]
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className="border-b border-border bg-surface px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted text-foreground">
                <Fingerprint className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-micro font-medium uppercase tracking-[0.24em] text-subtle-foreground">
                  索引审计
                </div>
                <div className="mt-1 text-title-sm font-semibold text-foreground">
                  {t("header.title")}
                </div>
              </div>
            </div>
            <IconButton
              label={t("actions.run")}
              variant="outline"
              className={cn(
                "size-9 rounded-[4px] border-border bg-surface",
                indexAuditLoading && "text-foreground border-border-strong",
              )}
              onClick={() => detachPromise(runIndexAudit())}
              disabled={!selectedDatasetId || indexAuditLoading}
            >
              {indexAuditLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </IconButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {indexAuditError && (
            <div className="rounded-[6px] border border-destructive/20 bg-destructive/5 p-4 text-caption leading-relaxed text-destructive">
              <AlertTriangle className="size-3.5 mb-1.5" />
              {indexAuditError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="text-caption text-subtle-foreground">
                {t("header.currentDataset")}
              </div>
              <div className="inline-flex items-center rounded-[4px] border border-border bg-surface px-3 py-1.5 text-compact font-medium text-foreground">
                <Database className="mr-2 size-3.5 text-foreground" />
                {overviewDatasetLabel || t("header.noneSelected")}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-caption text-subtle-foreground">
                索引状态
              </div>
              <div
                className={cn(
                  "inline-flex items-center rounded-[4px] border px-3 py-1.5 text-compact font-medium",
                  statusToneClassName,
                )}
              >
                <span className="mr-2 size-1.5 rounded-full bg-current opacity-75" />
                {auditStatus.label}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {metricCards.map((item) => (
                <div
                  key={item.key}
                  className="rounded-[6px] border border-border bg-surface px-3 py-3 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-micro font-medium text-subtle-foreground">
                          {item.label}
                        </div>
                        {item.estimated ? (
                          <span className="rounded-[4px] border border-border bg-muted px-2 py-0.5 text-micro font-medium text-muted-foreground">
                            估算
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 font-mono text-body font-semibold tabular-nums text-foreground">
                        {item.value}
                      </div>
                      <div className="mt-1 text-micro text-subtle-foreground">
                        {item.meta}
                      </div>
                    </div>
                    <div className="relative flex size-7.5 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted text-foreground">
                      <item.icon className="size-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border pt-3.5">
              <div className="text-caption text-subtle-foreground">
                最后同步
              </div>
              <div className="text-body font-medium text-foreground">
                {indexAudit || hasAggregateOverview
                  ? "已完成当前数据集索引审计"
                  : "尚未运行"}
              </div>
              <div className="inline-flex items-center rounded-[4px] bg-success/10 px-3 py-1 text-caption font-medium text-success">
                {indexAudit || hasAggregateOverview ? "同步完成" : "等待执行"}
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-3.5">
              <div className="text-compact font-medium text-foreground">
                健康检查清单
              </div>
              <div className="space-y-3">
                {healthChecklist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-[4px]",
                          item.state === "ok" && "bg-success/10 text-success",
                          item.state === "warning" &&
                            "bg-warning/10 text-warning",
                          item.state === "pending" &&
                            "bg-muted/30 text-muted-foreground",
                        )}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className="text-compact text-foreground">
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-[4px] px-2.5 py-1 text-micro font-medium",
                        item.state === "ok" && "bg-success/10 text-success",
                        item.state === "warning" &&
                          "bg-warning/10 text-warning",
                        item.state === "pending" &&
                          "bg-muted/30 text-muted-foreground",
                      )}
                    >
                      {getChecklistStateLabel(item.state)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {renderChannelStatusSummary()}
            {renderReconcileAction()}

            <Button
              type="button"
              variant="outline"
              aria-expanded={detailsExpanded}
              aria-controls="knowledge-index-detail-panel"
              onClick={() => {
                if (!hasIndexDetails) {
                  if (selectedDatasetId && !indexAuditLoading) {
                    detachPromise(runIndexAudit());
                  }
                  return;
                }
                setDetailsExpanded((expanded) => !expanded);
              }}
              disabled={
                !hasIndexDetails && (!selectedDatasetId || indexAuditLoading)
              }
              className="h-11 w-full rounded-[4px] border-border bg-surface text-compact font-medium pointer-fine:sm:h-8"
            >
              {!hasIndexDetails && indexAuditLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {detailsButtonLabel}
              {hasIndexDetails ? (
                <ChevronRight
                  className={cn(
                    "ml-2 size-4 transition-transform",
                    detailsExpanded && "rotate-90",
                  )}
                />
              ) : null}
            </Button>
            {detailsExpanded && hasIndexDetails ? (
              <div
                id="knowledge-index-detail-panel"
                className="space-y-3 rounded-[6px] border border-border bg-surface p-4 text-caption"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-compact font-medium text-foreground">
                      索引明细
                    </div>
                    <div className="mt-1 text-micro text-subtle-foreground">
                      审计范围：{overviewDatasetLabel}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-[4px] border px-2.5 py-1 text-micro font-medium",
                      statusToneClassName,
                    )}
                  >
                    {auditStatus.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {indexDetailRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[6px] border border-border bg-surface px-3 py-2"
                    >
                      <div className="text-micro text-subtle-foreground">
                        {label}
                      </div>
                      <div className="mt-1 truncate font-mono text-caption font-medium text-foreground" title={value}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                {indexAudit ? (
                  <div className="rounded-[6px] border border-border bg-muted/30 px-3 py-2 text-micro leading-5 text-subtle-foreground">
                    当前明细来自后端索引一致性审计；如果发现缺失或孤儿向量，优先重新入库受影响文档。
                  </div>
                ) : (
                  <div className="rounded-[6px] border border-border bg-muted/30 px-3 py-2 text-micro leading-5 text-subtle-foreground">
                    当前为全局聚合估算；选择单个数据集并运行审计后，可查看缺失向量、孤儿向量和后端一致性明细。
                  </div>
                )}
                {renderChannelStatusSummary()}
                {renderReconcileAction()}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <Panel
        padding="none"
        className="relative overflow-hidden rounded-[6px] border border-border bg-surface"
      >
        <div className="p-8">
          {renderDiagnosticHeader()}

          {indexAuditError ? (
            <div className="mb-6 flex items-start gap-3 rounded-[6px] border border-destructive/20 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="space-y-1">
                <div className="text-caption font-medium text-destructive">
                  审计执行中断
                </div>
                <p className="text-micro font-medium leading-relaxed text-destructive">
                  {indexAuditError}
                </p>
              </div>
            </div>
          ) : null}

          {indexAudit ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {metricCards.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-[6px] border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                  >
                    <div className="mb-2 text-micro font-medium uppercase text-subtle-foreground">
                      {item.label}
                    </div>
                    <div className="font-mono text-title-sm font-semibold tabular-nums text-foreground">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2 mt-8">
                {(indexAudit.vector_ids_missing_in_backend_sample || [])
                  .length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-micro font-medium uppercase text-destructive">
                      <div className="size-1.5 rounded-full bg-destructive" />
                      {t("samples.missingInBackend")}
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-[6px] border border-destructive/10 bg-destructive/[0.02] p-4 text-micro font-mono leading-loose text-destructive no-scrollbar">
                      {(
                        indexAudit.vector_ids_missing_in_backend_sample || []
                      ).join("\n")}
                    </pre>
                  </div>
                )}

                {(indexAudit.milvus_orphan_ids_sample || []).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-micro font-medium uppercase text-warning">
                      <div className="size-1.5 rounded-full bg-warning" />
                      {t("samples.orphanIds")}
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-[6px] border border-warning/10 bg-warning/[0.02] p-4 text-micro font-mono leading-loose text-warning no-scrollbar">
                      {(indexAudit.milvus_orphan_ids_sample || []).join("\n")}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 py-20 text-center">
              <div className="flex size-20 items-center justify-center rounded-[6px] border border-dashed border-border bg-surface">
                <Scan className="size-8 text-subtle-foreground" />
              </div>
              <div className="max-w-xs space-y-2">
                <h5 className="text-compact font-medium text-foreground">
                  {t("empty.title")}
                </h5>
                <p className="text-caption font-medium leading-relaxed text-subtle-foreground">
                  {t("empty.description")}
                </p>
              </div>
              {selectedDatasetId ? (
                <Button
                  onClick={() => detachPromise(runIndexAudit())}
                  className="px-6 text-micro font-medium"
                >
                  <Activity className="mr-2 size-3.5" />
                  立即初始化审计
                </Button>
              ) : (
                <div className="rounded-[4px] border border-warning/30 bg-warning/10 px-3 py-1 text-micro font-medium uppercase tracking-[0.15em] text-warning">
                  {t("empty.waitingForDataset")}
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
