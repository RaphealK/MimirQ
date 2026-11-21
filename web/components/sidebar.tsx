/**
 * 左侧边栏组件 - 展示文档列表
 */
"use client";

import { useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FileText,
  Upload,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Search,
} from "lucide-react";
import { useDocuments } from "@/hooks/use-documents";
import { useLocalSearch } from "@/hooks/use-local-search";
import { cn, formatFileSize, formatDate } from "@/lib/utils";
import type { Document } from "@/types";
import { ManualUploadDialog } from "@/components/manual-upload-dialog";
import { DocumentDetailDialog } from "@/components/document-detail-dialog";
import { getParserLabel } from "@/lib/parser-options";
import { PipelineVisualizer } from "@/components/ui/pipeline-visualizer";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/client-logging";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UPLOAD_ACCEPT } from "@/lib/upload-extensions";

type SidebarVariant = "app" | "workbench";
type SidebarProps = Readonly<{ variant?: SidebarVariant }>;

export function Sidebar({ variant = "app" }: SidebarProps = {}) {
  const {
    documents,
    isLoading,
    uploadDocuments,
    cancelDocument,
    deleteDocument,
    loadDocuments,
  } = useDocuments();
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const isWorkbench = variant === "workbench";

  const { term, setTerm, results } = useLocalSearch(documents, {
    fields: ["filename", "file_type"],
    storeFields: ["id"],
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 估算高度，卡片大约 80-100px
    overscan: 5,
  });

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      await uploadDocuments(Array.from(files), {
        maxRetries: 1,
        maxConcurrent: 5,
      });
    } catch (error) {
      reportClientError("Sidebar document upload failed", error);
    }
    e.target.value = "";
  };

  // 切换文档选择
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  };

  // 获取状态图标 - 更精致的版本
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="size-4 text-success" />;
      case "failed":
        return <AlertCircle className="size-4 text-destructive" />;
      case "processing":
      case "pending":
        return (
          <Loader2 className="size-4 text-muted-foreground animate-spin motion-reduce:animate-none" />
        );
      default:
        return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-surface text-foreground",
        isWorkbench
          ? "h-full w-full min-h-0 overflow-hidden"
          : "relative z-20 h-dvh w-80",
      )}
    >
      {/* 头部 - 增加空间感 */}
      <div className="border-b border-border/40 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-[4px] bg-muted">
              <FileText className="size-4 text-foreground" />
            </div>
            <h2 className="text-title-sm font-semibold text-foreground">
              知识库
            </h2>
          </div>
          <span className="rounded-[4px] bg-muted px-2 py-0.5 text-caption font-medium tabular-nums text-muted-foreground">
            {documents.length}
          </span>
        </div>

        <div className="space-y-3">
          <div className="group relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="快速搜索文档..."
              className="h-8 w-full rounded-[4px] border border-border bg-background/35 pl-9 pr-3 text-caption outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:bg-background/55 focus-ring"
            />
            {term && (
              <button
                onClick={() => setTerm("")}
                aria-label="清除搜索"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] p-1 hover:bg-muted focus-ring"
              >
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>

          <label
            htmlFor="file-upload"
            className="group relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-foreground bg-foreground px-4 py-3 text-background transition-colors duration-120 hover:opacity-[0.88]"
          >
            <Upload className="size-4" />
            <span className="text-compact font-medium">上传文档</span>
            <input
              id="file-upload"
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <div className="grid grid-cols-1">
            <ManualUploadDialog onUploaded={loadDocuments} />
          </div>
        </div>

        {selectedDocIds.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-[4px] border border-border bg-raised px-1 py-1">
            <p className="pl-2 text-caption text-muted-foreground">
              已选 {selectedDocIds.length} 项
            </p>
            <button
              onClick={() => setSelectedDocIds([])}
              aria-label="清除已选"
              className="rounded-[4px] p-1 transition-colors hover:bg-muted"
            >
              <X className="size-3 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* 文档列表 - 优化滚动体验 (虚拟列表 + 本地搜索) */}
      <div
        ref={parentRef}
        data-page-scroll-container="true"
        className="flex-1 overflow-y-auto p-4 no-scrollbar"
      >
        {(() => {
          if (isLoading && documents.length === 0) {
            return (
              <div className="flex h-40 flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
                <p className="text-caption text-muted-foreground">加载中...</p>
              </div>
            );
          } else if (results.length === 0) {
            return (
              <div className="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
                <div
                  aria-hidden="true"
                  className="flex size-24 items-center justify-center rounded-[6px] border border-border bg-surface"
                >
                  <FileText className="size-8 text-muted-foreground" />
                </div>
                <p className="text-compact font-medium text-foreground">
                  {documents.length > 0
                    ? "未找到匹配文档"
                    : "暂无文档，请上传知识"}
                </p>
              </div>
            );
          } else {
            return (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const doc = results[virtualRow.index];
                  if (!doc) return null;
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="pb-3"
                    >
                      <DocumentCard
                        document={doc}
                        index={virtualRow.index}
                        isSelected={selectedDocIds.includes(doc.id)}
                        onSelect={() => toggleDocumentSelection(doc.id)}
                        onCancel={() => cancelDocument(doc.id)}
                        onDelete={() => deleteDocument(doc.id)}
                        getStatusIcon={getStatusIcon}
                      />
                    </div>
                  );
                })}
              </div>
            );
          }
        })()}
      </div>
    </aside>
  );
}

// Alias export: keep a stable, explicit name for the knowledge-library sidebar.
export const KnowledgeSidebar = Sidebar;

// 文档卡片组件
function DocumentCard({
  document,
  index,
  isSelected,
  onSelect,
  onCancel,
  onDelete,
  getStatusIcon,
}: Readonly<{
  document: Document;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onDelete: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
}>) {
  const parserBackend = (document.metadata?.parser_backend as string) || "";
  const parserLabel = parserBackend ? getParserLabel(parserBackend) : null;
  return (
    <div
      className={cn(
        "group relative h-full cursor-pointer rounded-[6px] border p-3 transition-colors duration-120",
        isSelected
          ? "border-border-strong bg-raised"
          : "border-border bg-surface hover:bg-muted/40",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-[inherit] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={onSelect}
        aria-label={`选择文档：${document.filename}`}
        aria-pressed={isSelected}
      />
      {isSelected ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-10 w-0.5 bg-foreground"
        />
      ) : null}
      <div className="pointer-events-none relative z-10">
        <div className="flex items-start gap-3">
          {/* 文件图标容器 */}
          <div
            className={cn(
              "flex items-center justify-center rounded-[4px] p-2 transition-colors",
              isSelected
                ? "bg-muted text-foreground"
                : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
            )}
          >
            <FileTypeIcon type={document.file_type} className="size-5" />
          </div>

          {/* 文档信息 */}
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={cn(
                  "truncate text-compact font-medium transition-colors",
                  isSelected ? "text-foreground" : "text-foreground",
                )}
              >
                {document.filename}
              </h3>
              <div className="shrink-0 pt-0.5 opacity-70">
                {getStatusIcon(document.status)}
              </div>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-micro font-medium tabular-nums text-muted-foreground">
                {formatFileSize(document.file_size)}
              </span>
              <span className="text-micro text-muted-foreground/60">
                {formatDate(document.created_at)}
              </span>
            </div>

            {/* 处理进度 */}
            {(document.status === "processing" ||
              document.status === "pending") && (
              <div className="mt-3">
                <PipelineVisualizer
                  progress={document.processing_progress}
                  className="w-[110%] origin-left scale-90 py-2"
                />
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-micro text-muted-foreground">
                    {document.current_stage || "处理中"}
                  </p>
                  <span className="font-mono text-micro tabular-nums text-foreground">
                    {document.processing_progress}%
                  </span>
                </div>
              </div>
            )}

            {/* 属性标签 */}
            {document.status === "completed" && (
              <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition-opacity duration-120 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
                <span className="rounded-[4px] bg-muted/80 px-1.5 py-0.5 text-micro text-muted-foreground">
                  {document.chunk_count} 片段
                </span>
                {parserLabel && (
                  <span className="rounded-[4px] bg-muted/80 px-1.5 py-0.5 text-micro text-muted-foreground">
                    {parserLabel}
                  </span>
                )}
              </div>
            )}

            {/* 错误信息 */}
            {(document.status === "failed" ||
              document.status === "quarantined") && (
              <p
                className={cn(
                  "mt-1 inline-block rounded-[4px] border px-1.5 py-0.5 text-micro font-medium",
                  document.status === "quarantined"
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-destructive/30 bg-destructive/10 text-destructive",
                )}
              >
                {document.status === "quarantined" ? "已隔离" : "处理失败"}
              </p>
            )}
          </div>
        </div>

        {/* 悬浮操作栏 */}
        <div
          className={cn(
            "pointer-events-auto absolute right-2 top-2 flex flex-col gap-1 opacity-0 transition-opacity duration-120 ease-out group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none",
          )}
        >
          <DocumentDetailDialog
            document={document}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={(e) => {
                  // Avoid triggering the card's click handler.
                  e.stopPropagation();
                }}
                className="size-8 rounded-[4px] bg-surface shadow-none hover:bg-muted hover:text-foreground"
                aria-label="查看详情"
                title="查看详情"
              >
                <FileText className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />

          {document.status === "processing" || document.status === "pending" ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              aria-label="取消处理"
              title="取消处理"
              className="size-8 rounded-[4px] bg-surface shadow-none hover:bg-warning/10 hover:text-warning"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    // Avoid triggering the card's click handler.
                    e.stopPropagation();
                  }}
                  aria-label="删除文档"
                  title="删除文档"
                  className="size-8 rounded-[4px] bg-surface shadow-none hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除文档？</AlertDialogTitle>
                  <AlertDialogDescription>
                    你将删除{" "}
                    <span className="font-mono">{document.filename}</span>
                    。此操作不可撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                    取消
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
