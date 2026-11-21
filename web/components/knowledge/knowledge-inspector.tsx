"use client";

import Link from "next/link";
import {
  CalendarClock,
  Database,
  ExternalLink,
  FileSearch,
  FolderTree,
  Hash,
  Layers,
  Route,
} from "lucide-react";

import { DocumentTags } from "@/components/documents/document-tags";
import { Button } from "@/components/ui/button";
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

function formatShortId(value: string) {
  const text = String(value || "").trim();
  if (!text) return EMPTY_VALUE;
  return text.length > 24 ? `${text.slice(0, 12)}…${text.slice(-8)}` : text;
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
}: Readonly<{ label: string; value: React.ReactNode; mono?: boolean }>) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 border-b border-border py-1.5 last:border-b-0">
      <span className="w-16 shrink-0 text-micro text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-caption text-foreground",
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

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <div className="text-compact font-medium text-foreground">文档详情</div>
        <div className="mt-0.5 text-micro text-muted-foreground">
          元数据、来源与切片入口
        </div>
      </div>
      <span className="font-mono text-micro tabular-nums text-muted-foreground">
        {selectedDocs.length}
      </span>
    </div>
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
            <MetaRow label="文档 ID" value={formatShortId(selected.id)} mono />
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
            <MetaRow
              label="大小"
              value={
                Number.isFinite(Number(selected.file_size))
                  ? formatFileSize(Number(selected.file_size))
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
                  : (selected.chunk_count ?? EMPTY_VALUE)
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

          {userTags.length ? (
            <div>
              <div className="mb-1 text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground">
                标签
              </div>
              <DocumentTags tags={userTags} max={6} dense />
            </div>
          ) : null}

          {sourcePath ? (
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground">
                <FolderTree className="size-3.5" aria-hidden="true" />
                来源路径
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

          <div className="grid grid-cols-3 border-y border-border py-2 text-micro text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileSearch className="size-3.5" aria-hidden="true" />
              来源
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Hash className="size-3.5" aria-hidden="true" />
              {selected.chunk_count ?? EMPTY_VALUE} 分块
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {selected.processed_at
                ? formatDate(selected.processed_at)
                : EMPTY_VALUE}
            </span>
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
        {header}
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
      {header}
      <div
        data-page-scroll-container="true"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar"
      >
        {content}
      </div>
    </Panel>
  );
}
