"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { useTranslations } from "next-intl";

import { DatasetFolderTree } from "@/components/document-library/dataset-folder-tree";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkbenchPane } from "@/components/workbench";
import { documentApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types";

type DocLifecycleFilter = "active" | "archived" | "disabled" | "all";
type DocStatusFilter =
  "all" | "completed" | "processing" | "failed" | "quarantined";
type DocCountValue = string | number;

type KnowledgeScopePanelProps = {
  className?: string;
  surface?: "pane" | "embedded";
  mode?: "documents" | "retrieval" | "settings";
  datasets: Dataset[];
  datasetsLoading?: boolean;

  datasetScope: string;
  setDatasetScope: (value: string) => void;
  datasetAllValue?: string;

  selectedDatasetId?: string;
  lifecycleFilter: DocLifecycleFilter;
  setLifecycleFilter: (value: DocLifecycleFilter) => void;
  folderPath: string | null;
  setFolderPath: (value: string | null) => void;

  statusFilter: DocStatusFilter;
  setStatusFilter: (value: DocStatusFilter) => void;
  totalDocs: DocCountValue;
  completedDocsValue: DocCountValue;
  processingDocsValue: DocCountValue;
  failedDocsValue: DocCountValue;
  quarantinedDocsValue: DocCountValue;
};

const ROW_CLASS =
  "flex min-h-11 w-full items-center gap-2 px-2 py-1 text-left text-compact transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 pointer-fine:sm:min-h-8";

export function KnowledgeScopePanel({
  className,
  surface = "pane",
  mode = "documents",
  datasets,
  datasetsLoading = false,
  datasetScope,
  setDatasetScope,
  datasetAllValue,
  selectedDatasetId,
  lifecycleFilter,
  setLifecycleFilter,
  folderPath,
  setFolderPath,
  statusFilter,
  setStatusFilter,
  totalDocs,
  completedDocsValue,
  processingDocsValue,
  failedDocsValue,
  quarantinedDocsValue,
}: Readonly<KnowledgeScopePanelProps>) {
  const t = useTranslations("KnowledgeScopePanel");
  const DATASET_ALL = datasetAllValue ?? "__all__";
  const showDocumentFilters = mode === "documents";

  const folderTreeParams = useMemo(
    () =>
      selectedDatasetId
        ? {
            dataset_id: selectedDatasetId,
            lifecycle: lifecycleFilter,
            max_depth: 20,
          }
        : null,
    [lifecycleFilter, selectedDatasetId],
  );
  const folderTreeQuery = useQuery({
    queryKey: queryKeys.documents.folders(folderTreeParams ?? undefined),
    enabled: showDocumentFilters && Boolean(folderTreeParams),
    queryFn: () => {
      if (!folderTreeParams) {
        throw new Error("Dataset folder tree params are required");
      }
      return documentApi.folders(folderTreeParams);
    },
  });
  const hasDirectoryFilter = Boolean(
    selectedDatasetId &&
    folderTreeQuery.data &&
    folderTreeQuery.data.total_with_source_path > 0,
  );

  useEffect(() => {
    if (!folderPath) return;
    if (!folderTreeQuery.data) return;
    if (folderTreeQuery.data.total_with_source_path > 0) return;
    setFolderPath(null);
  }, [folderPath, folderTreeQuery.data, setFolderPath]);

  const statusItems = (
    [
      { key: "all", count: totalDocs },
      { key: "completed", count: completedDocsValue },
      { key: "processing", count: processingDocsValue },
      { key: "failed", count: failedDocsValue },
      { key: "quarantined", count: quarantinedDocsValue },
    ] satisfies Array<{ key: DocStatusFilter; count: DocCountValue }>
  ).map((item) => ({
    ...item,
    label: t(`status.${item.key}.label`),
    count: Number(item.count || 0),
  }));

  const datasetItems = [
    { id: DATASET_ALL, name: t("dataset.all") },
    ...datasets.map((dataset) => ({ id: dataset.id, name: dataset.name })),
  ];

  const sectionClassName = "border-b border-border px-3 py-3";
  const sectionTitleClassName =
    "mb-1.5 text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground";

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Filter className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-compact font-medium text-foreground">筛选</span>
      </div>

      <div
        data-knowledge-scope-panel="true"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <section className={sectionClassName}>
          <div className={sectionTitleClassName}>{t("dataset.label")}</div>
          <div
            className="flex flex-col"
            role="listbox"
            aria-label={t("dataset.ariaLabel")}
          >
            {datasetsLoading ? (
              <div className="px-2 py-1.5 text-caption text-muted-foreground">
                {t("dataset.loading")}
              </div>
            ) : (
              datasetItems.map((item) => {
                const isActive = datasetScope === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => setDatasetScope(item.id)}
                    className={cn(
                      ROW_CLASS,
                      isActive
                        ? "bg-raised font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-3.5 w-0.5 shrink-0",
                        isActive ? "bg-foreground" : "bg-transparent",
                      )}
                    />
                    <span className="min-w-0 truncate" title={item.name}>
                      {item.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {showDocumentFilters ? (
          <section className={sectionClassName}>
            <div className={sectionTitleClassName}>{t("status.label")}</div>
            <div className="flex flex-col">
              {statusItems.map((item) => (
                <label
                  key={item.key}
                  className={cn(
                    ROW_CLASS,
                    "cursor-pointer",
                    statusFilter === item.key
                      ? "bg-raised text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="knowledge-document-status"
                    value={item.key}
                    checked={statusFilter === item.key}
                    onChange={() => setStatusFilter(item.key)}
                    className="size-3.5 shrink-0 cursor-pointer accent-[hsl(var(--foreground))]"
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.key === "all" ? null : (
                    <span className="font-mono text-micro tabular-nums text-muted-foreground">
                      {item.count}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {showDocumentFilters && selectedDatasetId && hasDirectoryFilter ? (
          <section className={sectionClassName}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className={cn(sectionTitleClassName, "mb-0")}>
                {t("folder.label")}
              </div>
              {folderPath ? (
                <button
                  type="button"
                  onClick={() => setFolderPath(null)}
                  className="inline-flex min-h-11 items-center text-micro pointer-coarse:min-w-11 text-foreground underline-offset-4 hover:underline pointer-fine:sm:min-h-8"
                >
                  {t("folder.clear")}
                </button>
              ) : null}
            </div>
            {folderPath ? (
              <div
                className="mb-1.5 truncate font-mono text-micro text-muted-foreground"
                title={folderPath}
              >
                {folderPath}
              </div>
            ) : null}
            <DatasetFolderTree
              datasetId={selectedDatasetId}
              lifecycle={lifecycleFilter}
              selectedPath={folderPath}
              onSelect={setFolderPath}
              showHeader={false}
            />
          </section>
        ) : null}

        {showDocumentFilters ? (
          <section className={sectionClassName}>
            <div className={sectionTitleClassName}>{t("lifecycle.label")}</div>
            <Select
              value={lifecycleFilter}
              onValueChange={(value) =>
                setLifecycleFilter(value as DocLifecycleFilter)
              }
            >
              <SelectTrigger
                className="w-full max-lg:text-[16px]"
                aria-label={t("lifecycle.ariaLabel")}
              >
                <SelectValue placeholder={t("lifecycle.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("lifecycle.active")}</SelectItem>
                <SelectItem value="disabled">
                  {t("lifecycle.disabled")}
                </SelectItem>
                <SelectItem value="archived">
                  {t("lifecycle.archived")}
                </SelectItem>
                <SelectItem value="all">{t("lifecycle.all")}</SelectItem>
              </SelectContent>
            </Select>
          </section>
        ) : null}
      </div>
    </div>
  );

  if (surface === "embedded") {
    return (
      <div
        className={cn("flex min-h-0 flex-1 flex-col bg-background", className)}
      >
        {body}
      </div>
    );
  }

  return <WorkbenchPane className={cn(className)}>{body}</WorkbenchPane>;
}
