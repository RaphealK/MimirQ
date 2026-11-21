"use client";

import Link from "next/link";
import {
  Copy,
  Database,
  ExternalLink,
  FolderTree,
  Layers,
  Route,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { DocumentTags } from "@/components/documents/document-tags";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { getFileTypeMeta } from "@/components/knowledge/file-type";
import { buildChunkPreviewDocumentHref } from "@/lib/chunk-preview-links";
import { getUserTagsFromDocument } from "@/lib/document-user-tags";
import { toTrimmedPrimitiveString } from "@/lib/primitive-text";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import type { Document } from "@/types";

type KnowledgeInspectorProps = {
  selectedDocs: Document[];
  children?: React.ReactNode;
  className?: string;
  embedded?: boolean;
  onOpenOriginal?: (doc: Document) => void;
};

const EMPTY_VALUE = "—";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStatusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "completed" || value === "ready") return "已就绪";
  if (value === "processing") return "处理中";
  if (value === "pending") return "等待";
  if (value === "failed") return "失败";
  if (value === "quarantined") return "隔离";
  if (value === "cancelled") return "已取消";
  return value || "未知";
}

function getLifecycleLabel(doc: Document) {
  if (doc.archived_at) return "已归档";
  if (doc.disabled_at) return "已禁用";
  return "启用中";
}

function getSourceTypeLabel(doc: Document) {
  const metadata = isRecord(doc.metadata) ? doc.metadata : {};
  const source =
    typeof metadata.source === "string" ? metadata.source.toLowerCase() : "";
  const sourcePath =
    typeof metadata.source_path === "string" ? metadata.source_path.trim() : "";
  if (
    source.includes("connector") ||
    source.includes("crawl") ||
    source.includes("jira")
  ) {
    return "连接器";
  }
  if (source.includes("url")) return "URL 导入";
  if (sourcePath) return "目录上传";
  return "手动导入";
}

function getParseQualityPercent(doc: Document): number | null {
  const metadata = isRecord(doc.metadata) ? doc.metadata : {};
  const quality = isRecord(metadata.parse_quality)
    ? metadata.parse_quality
    : null;
  const rawScore = quality?.score;
  if (typeof rawScore !== "number" || !Number.isFinite(rawScore)) return null;
  return Math.round(rawScore * 100);
}

function buildSourceTrail(sourcePath: string) {
  return sourcePath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function MetaRow({
  label,
  value,
  mono = false,
  wrap = false,
}: Readonly<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  wrap?: boolean;
}>) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 border-b border-border py-1.5 last:border-b-0">
      <span className="w-16 shrink-0 text-micro text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 text-caption text-foreground",
          wrap ? "break-all whitespace-normal" : "truncate",
          mono && "font-mono tabular-nums",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function KnowledgeInspector({
  selectedDocs,
  children,
  className,
  embedded = false,
  onOpenOriginal,
}: Readonly<KnowledgeInspectorProps>) {
  const t = useTranslations("KnowledgeDocumentsPanel");
  const selected = selectedDocs.length === 1 ? selectedDocs[0] : null;
  const fileType = selected ? getFileTypeMeta(selected) : null;
  const TypeIcon = fileType?.icon;
  const metadata = selected?.metadata;
  const sourcePath = selected
    ? toTrimmedPrimitiveString(metadata?.source_path)
    : "";
  const sourceTrail = buildSourceTrail(sourcePath);
  const parserLabel = selected
    ? toTrimmedPrimitiveString(metadata?.parser_backend) || "自动"
    : EMPTY_VALUE;
  const userTags = selected ? getUserTagsFromDocument(selected) : [];
  const qualityPercent = selected ? getParseQualityPercent(selected) : null;
  const sourceTypeLabel = selected ? getSourceTypeLabel(selected) : EMPTY_VALUE;

  const copySourcePath = useCallback(
    async (path: string) => {
      try {
        await globalThis.navigator.clipboard.writeText(path);
        toast.success(t("toasts.copySourcePath"));
      } catch {
        toast.error(t("toasts.copyFailed"));
      }
    },
    [t],
  );

  const summary = (() => {
    if (selected) {
      return (
        <div className="space-y-3">
          <div className="flex min-w-0 items-start gap-3">
            {fileType && TypeIcon ? (
              <div
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center border",
                  fileType.bg,
                  fileType.border,
                  fileType.color,
                )}
              >
                <TypeIcon className="size-4" aria-hidden="true" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="break-words text-body font-medium leading-5 text-foreground">
                {selected.filename}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-muted-foreground">
                <span>{getStatusLabel(selected.status)}</span>
                <span aria-hidden="true">·</span>
                <span>{getLifecycleLabel(selected)}</span>
                {fileType ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{fileType.label}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-t border-border">
            <MetaRow
              label="文档 ID"
              value={selected.id || EMPTY_VALUE}
              mono
              wrap
            />
            <MetaRow
              label="数据集"
              value={
                selected.dataset_id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Database
                      className="size-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {selected.dataset_id}
                  </span>
                ) : (
                  EMPTY_VALUE
                )
              }
            />
            <MetaRow label="来源" value={sourceTypeLabel} />
            <MetaRow
              label="大小"
              value={
                typeof selected.file_size === "number" &&
                Number.isFinite(selected.file_size)
                  ? formatFileSize(selected.file_size)
                  : EMPTY_VALUE
              }
              mono
            />
            <MetaRow
              label="分块"
              value={
                selected.status === "processing" ||
                selected.status === "pending"
                  ? EMPTY_VALUE
                  : typeof selected.chunk_count === "number" &&
                      Number.isFinite(selected.chunk_count)
                    ? selected.chunk_count
                    : EMPTY_VALUE
              }
              mono
            />
            <MetaRow
              label="质量"
              value={
                qualityPercent === null ? EMPTY_VALUE : `${qualityPercent}%`
              }
              mono
            />
            <MetaRow
              label="创建"
              value={
                selected.created_at
                  ? formatDate(selected.created_at)
                  : EMPTY_VALUE
              }
              mono
            />
            <MetaRow
              label="更新"
              value={
                selected.updated_at || selected.created_at
                  ? formatDate(selected.updated_at || selected.created_at)
                  : EMPTY_VALUE
              }
              mono
            />
            <MetaRow label="解析器" value={parserLabel} />
          </div>

          {qualityPercent !== null && qualityPercent < 60 ? (
            <p className="border border-warning/40 bg-warning/10 px-2 py-1.5 text-micro text-warning">
              {t("row.parseQualityLow", { score: qualityPercent })}
            </p>
          ) : null}

          {userTags.length ? (
            <div>
              <div className="mb-1 text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground">
                标签
              </div>
              <DocumentTags tags={userTags} max={0} dense />
            </div>
          ) : null}

          {sourcePath ? (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground">
                  <FolderTree className="size-3.5" aria-hidden="true" />
                  来源路径
                </div>
                <IconButton
                  label={t("actions.copySourcePath")}
                  variant="ghost"
                  onClick={() => void copySourcePath(sourcePath)}
                >
                  <Copy className="size-3.5" />
                </IconButton>
              </div>
              {sourceTrail.length > 1 ? (
                <div className="mb-1 break-words text-caption text-muted-foreground">
                  {sourceTrail.slice(0, -1).join(" / ")}
                </div>
              ) : null}
              <div className="break-all font-mono text-micro leading-4 text-foreground">
                {sourcePath}
              </div>
            </div>
          ) : null}

          <div className="grid gap-1.5 sm:grid-cols-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={buildChunkPreviewDocumentHref(selected.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Layers className="size-3.5" aria-hidden="true" />
                切片管理
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/knowledge/${selected.id}/health`}>
                <Route className="size-3.5" aria-hidden="true" />
                健康卡片
              </Link>
            </Button>
            {onOpenOriginal ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="sm:col-span-2"
                onClick={() => onOpenOriginal(selected)}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                打开原文抽屉
              </Button>
            ) : null}
          </div>

          {children}
        </div>
      );
    }

    if (selectedDocs.length > 1) {
      return (
        <div className="border border-border px-3 py-4 text-caption text-muted-foreground">
          已选择 {selectedDocs.length} 份文档。请收窄选择范围以查看单文档详情。
        </div>
      );
    }

    return (
      <div className="border border-border px-3 py-4 text-caption text-muted-foreground">
        选择一个文档以查看详情。
      </div>
    );
  })();

  const content = <div className="space-y-3 p-4">{summary}</div>;

  if (embedded) {
    return (
      <div
        className={cn("flex min-h-0 flex-1 flex-col bg-background", className)}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
          {content}
        </div>
      </div>
    );
  }

  return (
    <Panel
      padding="none"
      className={cn("flex min-h-0 flex-col overflow-hidden", className)}
    >
      <div
        data-page-scroll-container="true"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar"
      >
        {content}
      </div>
    </Panel>
  );
}
