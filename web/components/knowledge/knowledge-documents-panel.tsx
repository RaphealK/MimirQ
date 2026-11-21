"use client";

import type { Dataset, Document } from "@/types";
import {
  Activity,
  Database,
  Download,
  Filter,
  Loader2,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type Key, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DocumentOperationsPanel } from "@/components/documents/document-operations-panel";
import { getFileTypeMeta } from "@/components/knowledge/file-type";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableActions,
  DataTableCell,
  DataTableHeadCell,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";
import { Link } from "@/i18n/navigation";
import { formatApiError } from "@/lib/api-errors";
import { buildChunkPreviewDocumentHref } from "@/lib/chunk-preview-links";
import { reportClientError } from "@/lib/client-logging";
import { toTrimmedPrimitiveString } from "@/lib/primitive-text";
import { detachPromise, formatDate, formatFileSize, cn } from "@/lib/utils";

type ViewMode = "grid" | "list";
type DocSortKey = "created_at" | "filename" | "file_size";
type DocSortDir = "asc" | "desc";
type TranslateValue = string | number | Date;
type TranslateFn = (
  key: string,
  values?: Record<string, TranslateValue>,
) => string;
type VirtualRowLike = {
  key: Key;
  index: number;
  start: number;
  end: number;
};
type VirtualizerLike = {
  getVirtualItems: () => VirtualRowLike[];
  getTotalSize: () => number;
  measureElement: (node: Element | null) => void;
};

type KnowledgeDocumentsPanelProps = {
  isLoading: boolean;
  documents: Document[];
  filteredDocuments: Document[];
  filteredDocumentsAll: Document[];
  totalDocumentsCount: number;
  datasets?: Dataset[];
  embedded?: boolean;

  selectedDatasetId?: string;
  datasetLabelById?: Record<string, string>;
  hasActiveFilters?: boolean;
  onSwitchToAllDatasets?: () => void;

  docFilter: string;
  setDocFilter: (value: string) => void;
  onClearFilters: () => void;

  sortKey: DocSortKey;
  sortDir: DocSortDir;
  setSortKey: (value: DocSortKey) => void;
  setSortDir: (value: DocSortDir) => void;

  viewMode: ViewMode;
  docGridColumns: number;
  docsGridVirtualizer: VirtualizerLike;
  docsTableVirtualizer: VirtualizerLike;

  page: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (page: number) => void;

  selectedDocIds: string[];
  setSelectedDocIds: (ids: string[]) => void;
  selectedSet: Set<string>;
  allVisibleSelected: boolean;
  toggleSelectAllVisible: () => void;
  toggleDocSelection: (docId: string) => void;

  batchDeleteOpen: boolean;
  setBatchDeleteOpen: (open: boolean) => void;
  batchDeleting: boolean;
  confirmBatchDelete: () => Promise<void>;
  batchLifecycleWorking: boolean;
  batchReingestWorking: boolean;
  runBatchReingest: () => Promise<void>;
  runBatchLifecycle: (
    action: "enable" | "disable" | "archive" | "unarchive",
  ) => Promise<void>;
  anySelectedDisabled: boolean;
  anySelectedEnabled: boolean;
  anySelectedArchived: boolean;
  anySelectedNotArchived: boolean;

  deleteDocument: (id: string) => Promise<void>;
  onPeek?: (docId: string) => void;
  onOpenDetail: (doc: Document, trigger?: HTMLElement | null) => void;
  onOpenOriginal?: (doc: Document) => void;
  onScrollContainerChange?: (el: HTMLDivElement | null) => void;
};

const GRID_COLUMN_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

const SORT_OPTIONS = [
  "created_at:desc",
  "created_at:asc",
  "filename:asc",
  "filename:desc",
  "file_size:desc",
  "file_size:asc",
] as const;

function getDocsGridColsClassName(docGridColumns: number): string {
  return GRID_COLUMN_CLASS[docGridColumns] ?? "grid-cols-3";
}

function safeFormatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatDate(value);
}

function formatChunkCount(doc: Document): string | number {
  if (doc.status === "processing" || doc.status === "pending") return "—";
  const count = doc.chunk_count;
  return typeof count === "number" && Number.isFinite(count) ? count : "—";
}

function formatDocumentSize(doc: Document): string {
  const size = doc.file_size;
  if (typeof size !== "number" || !Number.isFinite(size)) return "—";
  return formatFileSize(size);
}

function getStatusBadge(
  status: string,
  t: TranslateFn,
): {
  status: "pending" | "processing" | "completed" | "failed" | "quarantined";
  label: string;
} {
  if (status === "completed" || status === "ready") {
    return { status: "completed", label: t("status.completed") };
  }
  if (status === "failed") {
    return { status: "failed", label: t("status.failed") };
  }
  if (status === "quarantined") {
    return { status: "quarantined", label: t("status.quarantined") };
  }
  if (status === "processing") {
    return { status: "processing", label: t("status.processing") };
  }
  return { status: "pending", label: t("status.pending") };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input,button,a,select,textarea,[role="menuitem"],[data-row-action]',
    ),
  );
}

export function KnowledgeDocumentsPanel({
  isLoading,
  documents,
  filteredDocuments,
  filteredDocumentsAll,
  totalDocumentsCount,
  embedded = false,
  datasets,
  selectedDatasetId,
  datasetLabelById,
  hasActiveFilters = false,
  onSwitchToAllDatasets,
  docFilter,
  setDocFilter,
  onClearFilters,
  sortKey,
  sortDir,
  setSortKey,
  setSortDir,
  viewMode,
  docGridColumns,
  docsGridVirtualizer,
  docsTableVirtualizer,
  page,
  pageSize,
  pageCount,
  onPageChange,
  selectedDocIds,
  setSelectedDocIds,
  selectedSet,
  allVisibleSelected,
  toggleSelectAllVisible,
  toggleDocSelection,
  batchDeleteOpen,
  setBatchDeleteOpen,
  batchDeleting,
  confirmBatchDelete,
  batchLifecycleWorking,
  batchReingestWorking,
  runBatchReingest,
  runBatchLifecycle,
  anySelectedDisabled,
  anySelectedEnabled,
  anySelectedArchived,
  anySelectedNotArchived,
  deleteDocument,
  onPeek,
  onOpenDetail,
  onOpenOriginal,
  onScrollContainerChange,
}: Readonly<KnowledgeDocumentsPanelProps>) {
  const t = useTranslations("KnowledgeDocumentsPanel");
  const [singleDeleteDoc, setSingleDeleteDoc] = useState<Document | null>(null);
  const [singleDeleteWorking, setSingleDeleteWorking] = useState(false);
  const [singleDeleteError, setSingleDeleteError] = useState<string | null>(
    null,
  );
  const [opsOpen, setOpsOpen] = useState(false);
  const rowElementsRef = useRef(new Map<string, HTMLTableRowElement | null>());

  const emptyValue = t("table.emptyValue");
  const showDatasetColumn = !selectedDatasetId;
  const tableColumnCount = showDatasetColumn ? 8 : 7;
  const docsGridColsClassName = getDocsGridColsClassName(docGridColumns);
  const peekChunksLabel = (() => {
    const resolved = t("actions.peekChunks");
    return resolved === "KnowledgeDocumentsPanel.actions.peekChunks"
      ? "切片管理"
      : resolved;
  })();
  const sortValue = `${sortKey}:${sortDir}`;
  const sortLabels: Record<(typeof SORT_OPTIONS)[number], string> = {
    "created_at:desc": t("sort.createdDesc"),
    "created_at:asc": t("sort.createdAsc"),
    "filename:asc": t("sort.filenameAsc"),
    "filename:desc": t("sort.filenameDesc"),
    "file_size:desc": t("sort.fileSizeDesc"),
    "file_size:asc": t("sort.fileSizeAsc"),
  };

  const aggregates = useMemo(() => {
    let totalChunks = 0;
    let totalCharacters = 0;
    let totalBytes = 0;
    let latestUpload = 0;
    let hasCharacters = documents.length > 0;
    let hasChunks = documents.length > 0;
    let hasFileSizes = documents.length > 0;

    for (const doc of documents) {
      if (
        typeof doc.chunk_count === "number" &&
        Number.isFinite(doc.chunk_count)
      ) {
        totalChunks += doc.chunk_count;
      } else {
        hasChunks = false;
      }
      if (
        typeof doc.total_characters === "number" &&
        Number.isFinite(doc.total_characters)
      ) {
        totalCharacters += doc.total_characters;
      } else {
        hasCharacters = false;
      }
      if (typeof doc.file_size === "number" && Number.isFinite(doc.file_size)) {
        totalBytes += doc.file_size;
      } else {
        hasFileSizes = false;
      }
      const uploaded = new Date(doc.created_at).getTime();
      if (Number.isFinite(uploaded) && uploaded > latestUpload) {
        latestUpload = uploaded;
      }
    }

    const averageChunkCharacters =
      hasCharacters && totalChunks > 0
        ? Math.round(totalCharacters / totalChunks)
        : null;

    return {
      totalChunks,
      totalBytes,
      latestUpload,
      averageChunkCharacters,
      hasChunks,
      hasFileSizes,
    };
  }, [documents]);

  const statItems: StatStripItem[] = [
    {
      id: "chunks",
      label: "总分块",
      value: aggregates.hasChunks
        ? `${aggregates.totalChunks.toLocaleString("zh-CN")}`
        : emptyValue,
      detail: "当前加载范围",
      mono: true,
    },
    {
      id: "average",
      label: "平均块长",
      value:
        aggregates.averageChunkCharacters === null
          ? emptyValue
          : `${aggregates.averageChunkCharacters.toLocaleString("zh-CN")}`,
      detail: "字符 / 分块",
      mono: true,
    },
    {
      id: "size",
      label: "文档体积",
      value: aggregates.hasFileSizes
        ? formatFileSize(aggregates.totalBytes)
        : emptyValue,
      detail: "文件字节",
      mono: true,
    },
    {
      id: "latest",
      label: "最近上传",
      value: aggregates.latestUpload
        ? formatDate(new Date(aggregates.latestUpload).toISOString())
        : emptyValue,
      detail: "按上传时间",
      mono: true,
    },
  ];

  const confirmSingleDelete = useCallback(async () => {
    const doc = singleDeleteDoc;
    if (!doc || singleDeleteWorking) return;

    setSingleDeleteWorking(true);
    setSingleDeleteError(null);
    try {
      await deleteDocument(doc.id);
      toast.success(t("toasts.deleteSuccess"));
      setSingleDeleteDoc(null);
    } catch (err: unknown) {
      reportClientError("Failed to delete knowledge document", err);
      setSingleDeleteError(
        formatApiError(err, t("singleDelete.errorFallback")),
      );
    } finally {
      setSingleDeleteWorking(false);
    }
  }, [deleteDocument, singleDeleteDoc, singleDeleteWorking, t]);

  const requestSingleDelete = useCallback((doc: Document) => {
    setSingleDeleteError(null);
    setSingleDeleteDoc(doc);
  }, []);

  const copyText = useCallback(
    async (text: string, okMsg: string) => {
      try {
        await globalThis.navigator.clipboard.writeText(text);
        toast.success(okMsg);
      } catch {
        toast.error(t("toasts.copyFailed"));
      }
    },
    [t],
  );

  const openDetail = useCallback(
    (doc: Document) => {
      onOpenDetail(doc, rowElementsRef.current.get(doc.id) ?? null);
    },
    [onOpenDetail],
  );

  const exportFilteredCsv = useCallback(() => {
    const rows = filteredDocumentsAll;
    if (!rows.length) return;
    const header = [
      "filename",
      "id",
      "dataset_id",
      "status",
      "chunk_count",
      "file_size",
      "created_at",
      "lifecycle",
      "source_path",
    ];
    const escape = (value: string | number) => {
      const raw = String(value);
      // Spreadsheet editors must treat filenames and paths as text.
      const cell =
        typeof value === "string" &&
        (/^[=+@-]/.test(raw.trimStart()) || /^[\t\r\n]/.test(raw))
          ? `'${raw}`
          : raw;
      return `"${cell.replaceAll('"', '""')}"`;
    };
    const lines = rows.map((doc) =>
      [
        doc.filename,
        doc.id,
        doc.dataset_id ?? "",
        doc.status,
        doc.chunk_count ?? "",
        doc.file_size ?? "",
        doc.created_at,
        doc.archived_at ? "archived" : doc.disabled_at ? "disabled" : "active",
        toTrimmedPrimitiveString(doc.metadata?.source_path),
      ]
        .map(escape)
        .join(","),
    );
    const csv = [header.map(escape).join(","), ...lines].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement("a");
    anchor.href = url;
    anchor.download = `knowledge-documents-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    anchor.click();
    globalThis.window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success(`已导出 ${rows.length} 条当前筛选记录`);
  }, [filteredDocumentsAll]);

  const renderRowMenu = (doc: Document) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label={t("actions.moreActions")}
          variant="ghost"
          data-row-action="true"
          className="size-11 text-muted-foreground sm:size-8"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={() =>
            onOpenDetail(doc, rowElementsRef.current.get(doc.id) ?? null)
          }
        >
          {t("actions.openInspector")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            if (onPeek) onPeek(doc.id);
            else
              globalThis.window.open(
                buildChunkPreviewDocumentHref(doc.id),
                "_blank",
                "noopener,noreferrer",
              );
          }}
        >
          {peekChunksLabel}
        </DropdownMenuItem>
        {onOpenOriginal ? (
          <DropdownMenuItem onSelect={() => onOpenOriginal(doc)}>
            {t("actions.previewContent")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            detachPromise(copyText(doc.id, t("toasts.copyDocumentId")))
          }
        >
          {t("actions.copyDocumentId")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            detachPromise(copyText(doc.filename, t("toasts.copyFilename")))
          }
        >
          {t("actions.copyFilename")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/knowledge/${doc.id}/health`}
            className="flex items-center"
          >
            <Activity className="mr-2 size-4" aria-hidden="true" />
            {t("actions.healthCard")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => requestSingleDelete(doc)}
        >
          <Trash2 className="mr-2 size-4" aria-hidden="true" />
          {t("actions.deleteDocument")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderGridDocCard = (doc: Document) => {
    const badge = getStatusBadge(doc.status, t);
    const fileType = getFileTypeMeta(doc);
    const TypeIcon = fileType.icon;
    return (
      <div
        key={doc.id}
        role="button"
        tabIndex={0}
        aria-label={`${t("actions.openInspector")}: ${doc.filename}`}
        onClick={(event) => {
          if (isInteractiveTarget(event.target)) return;
          onOpenDetail(doc, event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenDetail(doc, event.currentTarget);
          }
        }}
        className={cn(
          "group relative flex h-full min-h-28 flex-col border-r border-b border-border bg-background p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          selectedSet.has(doc.id) ? "bg-raised" : "hover:bg-muted/50",
        )}
      >
        {selectedSet.has(doc.id) ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-0.5 bg-foreground"
          />
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center border",
                fileType.bg,
                fileType.border,
                fileType.color,
              )}
            >
              <TypeIcon className="size-4" aria-hidden="true" />
            </span>
            <span
              className="truncate text-compact font-medium text-foreground"
              title={doc.filename}
            >
              {doc.filename}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <label
              className="flex size-8 cursor-pointer items-center justify-center [@media(hover:none)]:size-11"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selectedSet.has(doc.id)}
                onChange={() => toggleDocSelection(doc.id)}
                aria-label={t("table.selectDocument", {
                  filename: doc.filename,
                })}
                className="size-4 cursor-pointer accent-[hsl(var(--foreground))]"
              />
            </label>
            {renderRowMenu(doc)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-micro text-muted-foreground">
          <StatusBadge status={badge.status} label={badge.label} dense />
          <span className="truncate">
            {datasetLabelById?.[doc.dataset_id || ""] || emptyValue}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-2 text-micro text-muted-foreground">
          <span className="font-mono tabular-nums">
            {formatChunkCount(doc)} 分块
          </span>
          <span className="font-mono tabular-nums">
            {formatDocumentSize(doc)}
          </span>
          <span className="font-mono tabular-nums">
            {safeFormatDate(doc.created_at)}
          </span>
        </div>
      </div>
    );
  };

  const visibleDocumentsCount = totalDocumentsCount;
  const pageStart = visibleDocumentsCount ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, visibleDocumentsCount);
  const isDatasetEmpty = documents.length === 0;
  const showEmptyState = visibleDocumentsCount === 0;
  const docsGridVirtualRows = docsGridVirtualizer.getVirtualItems();
  const docsTableVirtualRows = docsTableVirtualizer.getVirtualItems();
  const docsTablePaddingTop = docsTableVirtualRows.length
    ? docsTableVirtualRows[0].start
    : 0;
  const docsTablePaddingBottom = docsTableVirtualRows.length
    ? docsTableVirtualizer.getTotalSize() -
      (docsTableVirtualRows.at(-1)?.end ?? 0)
    : 0;

  const paginationFooter = (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-3 py-2">
      <span className="text-caption text-muted-foreground">
        显示 {pageStart}-{pageEnd} / 共 {visibleDocumentsCount} 条
      </span>
      <span className="inline-flex h-8 items-center border border-border px-2 text-caption text-muted-foreground">
        {pageSize} 条/页
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
          disabled={page <= 1}
          aria-label="上一页"
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        <span className="inline-flex h-8 min-w-[5rem] items-center justify-center border border-border px-2 font-mono text-caption tabular-nums text-foreground">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
          disabled={page >= pageCount}
          aria-label="下一页"
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );

  const inventoryToolbar = (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <SearchInput
        value={docFilter}
        onValueChange={setDocFilter}
        containerClassName="min-w-0 w-full md:max-w-[320px]"
        inputClassName="text-caption"
        placeholder={
          showDatasetColumn
            ? "搜索文件名 / 文档 ID / 数据集 ID"
            : "搜索文件名 / 文档 ID"
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={sortValue}
          onValueChange={(value) => {
            const [nextKey, nextDir] = value.split(":") as [
              DocSortKey,
              DocSortDir,
            ];
            setSortKey(nextKey);
            setSortDir(nextDir);
          }}
        >
          <SelectTrigger
            className="w-[9.5rem]"
            aria-label={t("sort.ariaLabel")}
          >
            <SelectValue placeholder={t("sort.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {sortLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t("actions.clearFilters")}
          </Button>
        ) : null}

        <Button
          type="button"
          variant={opsOpen ? "secondary" : "outline"}
          size="sm"
          aria-expanded={opsOpen}
          onClick={() => setOpsOpen((open) => !open)}
        >
          <Activity className="size-3.5" aria-hidden="true" />
          运维工具
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!filteredDocumentsAll.length}
          onClick={exportFilteredCsv}
        >
          <Download className="size-3.5" aria-hidden="true" />
          导出清单
        </Button>
      </div>
    </div>
  );

  const emptyContent = (
    <div className="flex h-full min-h-0 items-center justify-center p-3">
      <EmptyState
        icon={isDatasetEmpty ? Database : Filter}
        title={isDatasetEmpty ? "该数据集暂无文档" : "未找到匹配的文档"}
        description={
          isDatasetEmpty
            ? "使用右上角「导入/新增」上传文档或创建连接器后，资产列表会在这里出现。"
            : "当前筛选条件没有命中文档，可以放宽范围、清空搜索，或切回全部数据集。"
        }
        className="min-h-[280px] w-full border-0 bg-transparent"
      >
        {isDatasetEmpty ? (
          <span className="text-caption text-muted-foreground">
            导入文档 → 自动解析 → 建立索引
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearFilters}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            清空所有筛选
          </Button>
        )}
        {selectedDatasetId && onSwitchToAllDatasets ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSwitchToAllDatasets}
          >
            回到全部数据集
          </Button>
        ) : null}
        {!selectedDatasetId && hasActiveFilters && onSwitchToAllDatasets ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSwitchToAllDatasets}
          >
            回到全部数据集
          </Button>
        ) : null}
      </EmptyState>
    </div>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        embedded ? "h-full flex-1" : "min-h-[560px]",
      )}
    >
      <AlertDialog
        open={Boolean(singleDeleteDoc)}
        onOpenChange={(open) => {
          if (open) return;
          setSingleDeleteDoc(null);
          setSingleDeleteWorking(false);
          setSingleDeleteError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {singleDeleteDoc
                ? t("singleDelete.title")
                : t("singleDelete.titleDefault")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {singleDeleteDoc ? (
                <span className="space-y-2">
                  <span className="block">
                    {t("singleDelete.description", {
                      filename: singleDeleteDoc.filename,
                    })}
                  </span>
                  <span className="block break-all font-mono text-caption text-muted-foreground">
                    {singleDeleteDoc.id}
                  </span>
                </span>
              ) : null}
              {singleDeleteError ? (
                <span className="mt-3 block border border-destructive/40 bg-destructive/10 px-3 py-2 text-caption text-destructive">
                  {singleDeleteError}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSingleDeleteDoc(null)}
              disabled={singleDeleteWorking}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => detachPromise(confirmSingleDelete())}
              disabled={singleDeleteWorking || !singleDeleteDoc}
            >
              {singleDeleteWorking
                ? t("actions.deleting")
                : t("actions.confirmDelete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedDocIds.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto border border-border bg-surface px-3 py-2 shadow-none">
          <span className="whitespace-nowrap text-caption text-muted-foreground">
            {t("selection.selectedCount", { count: selectedDocIds.length })}
          </span>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <span className="whitespace-nowrap text-micro text-muted-foreground">
            批量操作
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
            onClick={toggleSelectAllVisible}
          >
            {allVisibleSelected
              ? t("selection.clearSelectAll")
              : t("selection.selectAllVisible")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => setSelectedDocIds([])}
          >
            {t("actions.clearSelection")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => detachPromise(runBatchReingest())}
            disabled={
              batchDeleting || batchLifecycleWorking || batchReingestWorking
            }
          >
            {batchReingestWorking ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            {batchReingestWorking
              ? t("actions.reingesting")
              : t("actions.reingest")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => detachPromise(runBatchLifecycle("disable"))}
            disabled={
              batchDeleting || batchLifecycleWorking || !anySelectedEnabled
            }
          >
            {t("actions.disable")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => detachPromise(runBatchLifecycle("enable"))}
            disabled={
              batchDeleting || batchLifecycleWorking || !anySelectedDisabled
            }
          >
            {t("actions.enable")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => detachPromise(runBatchLifecycle("archive"))}
            disabled={
              batchDeleting || batchLifecycleWorking || !anySelectedNotArchived
            }
          >
            {t("actions.archive")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => detachPromise(runBatchLifecycle("unarchive"))}
            disabled={
              batchDeleting || batchLifecycleWorking || !anySelectedArchived
            }
          >
            {t("actions.unarchive")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="whitespace-nowrap text-destructive hover:text-destructive"
            onClick={() => setBatchDeleteOpen(true)}
            disabled={batchDeleting || batchLifecycleWorking}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t("actions.batchDelete")}
          </Button>
        </div>
      ) : null}

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("batchDelete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("batchDelete.description", { count: selectedDocIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBatchDeleteOpen(false)}
              disabled={batchDeleting}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => detachPromise(confirmBatchDelete())}
              disabled={batchDeleting || selectedDocIds.length === 0}
            >
              {batchDeleting
                ? t("actions.deleting")
                : t("actions.confirmDelete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={opsOpen} onOpenChange={setOpsOpen}>
        <SheetContent
          side="right"
          className="flex w-[min(640px,calc(100vw-16px))] flex-col gap-0 overflow-hidden border-l border-border bg-surface p-0 shadow-none sm:max-w-[640px]"
          overlayClassName="bg-transparent"
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-title-sm">运维工具</SheetTitle>
            <SheetDescription className="text-caption text-muted-foreground">
              当前知识库和勾选文档的统计、解析内容、重复文件、生命周期和批量移动操作。
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <DocumentOperationsPanel
              selectedDocumentIds={selectedDocIds}
              datasetId={selectedDatasetId}
              datasets={datasets}
            />
          </div>
        </SheetContent>
      </Sheet>

      <StatStrip items={statItems} className="border-t-0" />

      <div className="border-b border-border px-3 py-2">{inventoryToolbar}</div>

      <div
        ref={onScrollContainerChange}
        data-knowledge-documents-scroll-container="true"
        className="h-full min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar [scrollbar-gutter:stable]"
      >
        {isLoading && isDatasetEmpty ? (
          <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
            <div className="flex items-center gap-2 text-caption">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("loading")}
            </div>
          </div>
        ) : showEmptyState ? (
          <>
            {emptyContent}
            {paginationFooter}
          </>
        ) : viewMode === "grid" ? (
          <>
            <div className="border-t border-l border-border p-0">
              <div
                aria-label={t("grid.ariaLabel")}
                className="relative border-border"
                style={{
                  height: `${docsGridVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {docsGridVirtualRows.map((virtualRow) => {
                  const cols = Math.max(1, docGridColumns);
                  const startIndex = virtualRow.index * cols;
                  const rowDocs = filteredDocuments.slice(
                    startIndex,
                    startIndex + cols,
                  );
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={docsGridVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="border-b border-border"
                    >
                      <div
                        className={cn(
                          "grid items-stretch",
                          docsGridColsClassName,
                        )}
                      >
                        {rowDocs.map(renderGridDocCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {paginationFooter}
          </>
        ) : (
          <>
            <DataTable className="asset-register table-fixed md:min-w-[880px]">
              <colgroup>
                <col className="w-11" />
                <col />
                {showDatasetColumn ? <col className="hidden md:table-column md:w-40" /> : null}
                <col className="w-[4.5rem] md:w-[6.5rem]" />
                <col className="hidden md:table-column md:w-[4.5rem]" />
                <col className="hidden md:table-column md:w-[5.5rem]" />
                <col className="hidden md:table-column md:w-[7rem]" />
                <col className="w-11 md:w-12" />
              </colgroup>
              <thead>
                <tr>
                  <DataTableHeadCell className="sticky top-0 z-10 bg-background">
                    <label className="flex size-8 cursor-pointer items-center justify-center [@media(hover:none)]:size-11">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-[hsl(var(--foreground))]"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        aria-label={t("table.selectAllVisible")}
                      />
                    </label>
                  </DataTableHeadCell>
                  <DataTableHeadCell className="sticky top-0 z-10 bg-background">
                    {t("table.columns.name")}
                  </DataTableHeadCell>
                  {showDatasetColumn ? (
                    <DataTableHeadCell className="hidden md:table-cell sticky top-0 z-10 bg-background">
                      {t("table.columns.dataset")}
                    </DataTableHeadCell>
                  ) : null}
                  <DataTableHeadCell className="sticky top-0 z-10 bg-background">
                    {t("table.columns.status")}
                  </DataTableHeadCell>
                  <DataTableHeadCell
                    numeric
                    className="hidden md:table-cell sticky top-0 z-10 bg-background"
                  >
                    {t("table.columns.chunks")}
                  </DataTableHeadCell>
                  <DataTableHeadCell
                    numeric
                    className="hidden md:table-cell sticky top-0 z-10 bg-background"
                  >
                    {t("table.columns.size")}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="hidden md:table-cell sticky top-0 z-10 bg-background">
                    {t("table.columns.uploadedAt")}
                  </DataTableHeadCell>
                  <DataTableHeadCell className="sticky top-0 z-10 bg-background">
                    <span className="sr-only">
                      {t("table.columns.actions")}
                    </span>
                  </DataTableHeadCell>
                </tr>
              </thead>
              <tbody>
                {docsTablePaddingTop > 0 ? (
                  <tr aria-hidden="true">
                    <td
                      colSpan={tableColumnCount}
                      className="p-0"
                      style={{ height: `${docsTablePaddingTop}px` }}
                    />
                  </tr>
                ) : null}

                {docsTableVirtualRows.map((virtualRow) => {
                  const doc = filteredDocuments[virtualRow.index];
                  if (!doc) return null;
                  const badge = getStatusBadge(doc.status, t);
                  const fileType = getFileTypeMeta(doc);
                  const TypeIcon = fileType.icon;
                  const datasetLabel =
                    datasetLabelById?.[doc.dataset_id || ""] || emptyValue;

                  return (
                    <DataTableRow
                      key={doc.id}
                      data-index={virtualRow.index}
                      selected={selectedSet.has(doc.id)}
                      onClick={(event) => {
                        if (isInteractiveTarget(event.target)) return;
                        onOpenDetail(doc, event.currentTarget);
                      }}
                      ref={(row) => {
                        if (row) rowElementsRef.current.set(doc.id, row);
                        else rowElementsRef.current.delete(doc.id);
                        docsTableVirtualizer.measureElement(row);
                      }}
                    >
                      <td className="w-10">
                        <label
                          className="flex size-8 cursor-pointer items-center justify-center [@media(hover:none)]:size-11"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer accent-[hsl(var(--foreground))]"
                            checked={selectedSet.has(doc.id)}
                            onChange={() => toggleDocSelection(doc.id)}
                            aria-label={t("table.selectDocument", {
                              filename: doc.filename,
                            })}
                          />
                        </label>
                      </td>
                      <DataTableCell name>
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center border",
                              fileType.bg,
                              fileType.border,
                              fileType.color,
                            )}
                          >
                            <TypeIcon className="size-3.5" aria-hidden="true" />
                          </span>
                          <span className="truncate" title={doc.filename}>
                            {doc.filename}
                          </span>
                        </span>
                      </DataTableCell>
                      {showDatasetColumn ? (
                        <DataTableCell className="hidden md:table-cell">
                          <span className="block truncate" title={datasetLabel}>
                            {datasetLabel}
                          </span>
                        </DataTableCell>
                      ) : null}
                      <DataTableCell>
                        <StatusBadge
                          status={badge.status}
                          label={badge.label}
                          dense
                        />
                      </DataTableCell>
                      <DataTableCell numeric className="hidden md:table-cell">
                        {formatChunkCount(doc)}
                      </DataTableCell>
                      <DataTableCell numeric className="hidden md:table-cell">
                        {formatDocumentSize(doc)}
                      </DataTableCell>
                      <DataTableCell className="hidden md:table-cell">
                        <span className="font-mono tabular-nums">
                          {safeFormatDate(doc.created_at)}
                        </span>
                      </DataTableCell>
                      <DataTableActions>{renderRowMenu(doc)}</DataTableActions>
                    </DataTableRow>
                  );
                })}

                {docsTablePaddingBottom > 0 ? (
                  <tr aria-hidden="true">
                    <td
                      colSpan={tableColumnCount}
                      className="p-0"
                      style={{ height: `${docsTablePaddingBottom}px` }}
                    />
                  </tr>
                ) : null}
              </tbody>
            </DataTable>

            {paginationFooter}
          </>
        )}
      </div>
    </div>
  );
}
