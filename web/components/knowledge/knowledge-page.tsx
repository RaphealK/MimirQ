"use client";

/**
 * 知识库管理页面
 * 文档资产工作台：真实 URL 状态 + 扁平筛选栏 + 40px 文档表格 + 单实例右抽屉。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Activity,
  Filter,
  History,
  LayoutGrid,
  ListIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AppFrame } from "@/components/app-frame";
import { DocumentViewerPanel } from "@/components/document-viewer-panel";
import { KnowledgeDocumentDrawer } from "@/components/knowledge/knowledge-document-drawer";
import { KnowledgeDocumentsPanel } from "@/components/knowledge/knowledge-documents-panel";
import { KnowledgeRetrievalPanel } from "@/components/knowledge/knowledge-retrieval-panel";
import { KnowledgeScopePanel } from "@/components/knowledge/knowledge-scope-panel";
import {
  KnowledgeConnectorRunsPanel,
  KnowledgeSettingsPanel,
} from "@/components/knowledge/knowledge-settings-panel";
import {
  parseKnowledgeQueryState,
  serializeKnowledgeQueryState,
  type KnowledgeQueryState,
} from "@/components/knowledge/use-knowledge-query-state";
import { useKnowledgeScrollContainer } from "@/components/knowledge/use-knowledge-scroll-container";
import { KnowledgeWorkbenchActions } from "@/components/knowledge/knowledge-workbench-actions";
import { RetrievePreviewPanel } from "@/components/rag/retrieve-preview-panel";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  WorkbenchPanelDialog,
  WorkbenchScaffold,
} from "@/components/workbench";

import { useConnectorRuns } from "@/hooks/use-connector-runs";
import { useDatasets } from "@/hooks/use-datasets";
import { useDocuments } from "@/hooks/use-documents";
import { useRouter, Link } from "@/i18n/navigation";
import { documentApi } from "@/lib/api";
import { formatApiError } from "@/lib/api-errors";
import { cn, detachPromise } from "@/lib/utils";
import { useDocumentView } from "@/store/document-view";
import type { Document } from "@/types";

const DATASET_ALL = "__all__";
const DOCUMENTS_PAGE_SIZE = 20;
type TabKey = "documents" | "retrieval" | "settings";

export default function KnowledgePage() {
  const t = useTranslations("KnowledgePage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openDocument } = useDocumentView();

  const initialQueryStateRef = useRef<KnowledgeQueryState | null>(null);
  initialQueryStateRef.current ??= parseKnowledgeQueryState(
    new URLSearchParams(searchParams.toString()),
    { datasetAllValue: DATASET_ALL },
  );
  const initialQueryState = initialQueryStateRef.current;

  const [activeTab, setActiveTab] = useState<TabKey>(
    initialQueryState.activeTab,
  );
  const [desktopScopeCollapsed, setDesktopScopeCollapsed] = useState(false);
  const [datasetScope, setDatasetScope] = useState<string>(
    initialQueryState.datasetScope,
  );
  const [docFilter, setDocFilter] = useState(initialQueryState.docFilter);
  const [statusFilter, setStatusFilter] = useState(
    initialQueryState.statusFilter,
  );
  const [lifecycleFilter, setLifecycleFilter] = useState(
    initialQueryState.lifecycleFilter,
  );
  const [folderPath, setFolderPath] = useState<string | null>(
    initialQueryState.folderPath,
  );
  const [sortKey, setSortKey] = useState(initialQueryState.sortKey);
  const [sortDir, setSortDir] = useState(initialQueryState.sortDir);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    initialQueryState.viewMode,
  );
  const [documentsPage, setDocumentsPage] = useState(1);
  const [activeConnectorRunId, setActiveConnectorRunId] = useState<
    string | null
  >(initialQueryState.connectorRunId);
  const [peekingDocId, setPeekingDocId] = useState<string | null>(null);
  const [showConnectorRunsPanel, setShowConnectorRunsPanel] = useState(false);
  const [showRetrievalAuditPanel, setShowRetrievalAuditPanel] = useState(false);
  const [mobileScopeOpen, setMobileScopeOpen] = useState(false);
  const detailTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const parsed = parseKnowledgeQueryState(
      new URLSearchParams(searchParams.toString()),
      { datasetAllValue: DATASET_ALL },
    );

    setActiveTab(parsed.activeTab);
    setDatasetScope(parsed.datasetScope);
    setDocFilter(parsed.docFilter);
    setStatusFilter(parsed.statusFilter);
    setLifecycleFilter(parsed.lifecycleFilter);
    setFolderPath(parsed.folderPath);
    setSortKey(parsed.sortKey);
    setSortDir(parsed.sortDir);
    setViewMode(parsed.viewMode);
    setActiveConnectorRunId(parsed.connectorRunId);
  }, [searchParams]);

  useEffect(() => {
    const nextQuery = serializeKnowledgeQueryState(
      {
        activeTab,
        viewMode,
        docFilter,
        statusFilter,
        lifecycleFilter,
        datasetScope,
        folderPath,
        sortKey,
        sortDir,
        connectorRunId: activeTab === "settings" ? activeConnectorRunId : null,
      },
      { datasetAllValue: DATASET_ALL },
    );
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;
    router.replace(nextQuery ? `/knowledge?${nextQuery}` : "/knowledge");
  }, [
    activeConnectorRunId,
    activeTab,
    datasetScope,
    docFilter,
    folderPath,
    lifecycleFilter,
    router,
    searchParams,
    sortDir,
    sortKey,
    statusFilter,
    viewMode,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setDesktopScopeCollapsed((prev) => !prev);
      }
    };

    globalThis.window.addEventListener("keydown", handleKeyDown);
    return () =>
      globalThis.window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedDatasetId =
    datasetScope === DATASET_ALL ? undefined : datasetScope;
  const documentsModeActive = activeTab === "documents";
  const { datasets, isLoading: datasetsLoading } = useDatasets();

  const {
    documents,
    isLoading,
    loadDocuments,
    deleteDocument,
    uploadDocuments,
    uploadDocumentFromUrl,
  } = useDocuments({
    dataset_id: selectedDatasetId,
    status:
      documentsModeActive && statusFilter !== "all" ? statusFilter : undefined,
    lifecycle:
      documentsModeActive && lifecycleFilter !== "all"
        ? lifecycleFilter
        : undefined,
    source_path_prefix: documentsModeActive
      ? folderPath || undefined
      : undefined,
  });

  const {
    connectorRuns,
    connectorRunsLoading,
    loadConnectorRuns,
    cancelConnectorRun,
    resumeConnectorRun,
    retryFailedConnectorRun,
  } = useConnectorRuns({
    selectedDatasetId,
  });

  const scopedDocuments = useMemo(() => {
    if (!selectedDatasetId) return documents;
    return documents.filter(
      (doc) => String(doc.dataset_id || "") === selectedDatasetId,
    );
  }, [documents, selectedDatasetId]);

  const filteredDocuments = useMemo(() => {
    const term = docFilter.trim().toLowerCase();
    const next = scopedDocuments.filter((doc) => {
      if (!term) return true;
      return (
        doc.filename.toLowerCase().includes(term) ||
        doc.id.toLowerCase().includes(term) ||
        (doc.dataset_id || "").toLowerCase().includes(term)
      );
    });

    next.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "filename")
        return a.filename.localeCompare(b.filename) * dir;
      if (sortKey === "file_size") return (a.file_size - b.file_size) * dir;
      return (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
        dir
      );
    });

    return next;
  }, [docFilter, scopedDocuments, sortDir, sortKey]);

  const documentsPageCount = Math.max(
    1,
    Math.ceil(filteredDocuments.length / DOCUMENTS_PAGE_SIZE),
  );
  const paginatedDocuments = useMemo(
    () =>
      filteredDocuments.slice(
        (documentsPage - 1) * DOCUMENTS_PAGE_SIZE,
        documentsPage * DOCUMENTS_PAGE_SIZE,
      ),
    [documentsPage, filteredDocuments],
  );

  const { sentinelRef: mainPaneSentinelRef } = useKnowledgeScrollContainer();
  const [documentsScrollEl, setDocumentsScrollEl] =
    useState<HTMLDivElement | null>(null);

  const docGridColumns = 3;
  const docGridRowCount = Math.ceil(paginatedDocuments.length / docGridColumns);
  // eslint-disable-next-line react-hooks/incompatible-library
  const docsGridVirtualizer = useVirtualizer({
    count: docGridRowCount,
    getScrollElement: () => documentsScrollEl,
    estimateSize: () => 148,
    overscan: 5,
  });
  const docsTableVirtualizer = useVirtualizer({
    count: paginatedDocuments.length,
    getScrollElement: () => documentsScrollEl,
    estimateSize: () => 40,
    overscan: 12,
  });

  useEffect(() => {
    setDocumentsPage(1);
  }, [
    datasetScope,
    docFilter,
    folderPath,
    lifecycleFilter,
    sortDir,
    sortKey,
    statusFilter,
  ]);

  useEffect(() => {
    setDocumentsPage((current) => Math.min(current, documentsPageCount));
  }, [documentsPageCount]);

  useEffect(() => {
    documentsScrollEl?.scrollTo({ top: 0 });
  }, [documentsScrollEl, datasetScope, docFilter, statusFilter]);

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchLifecycleWorking, setBatchLifecycleWorking] = useState(false);
  const [batchReingestWorking, setBatchReingestWorking] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedDocIds), [selectedDocIds]);
  const allVisibleSelected =
    paginatedDocuments.length > 0 &&
    paginatedDocuments.every((doc) => selectedSet.has(doc.id));
  const selectedDocuments = useMemo(
    () => filteredDocuments.filter((doc) => selectedSet.has(doc.id)),
    [filteredDocuments, selectedSet],
  );

  const anySelectedEnabled = useMemo(
    () => selectedDocuments.some((doc) => !doc.disabled_at),
    [selectedDocuments],
  );
  const anySelectedDisabled = useMemo(
    () => selectedDocuments.some((doc) => doc.disabled_at),
    [selectedDocuments],
  );
  const anySelectedArchived = useMemo(
    () => selectedDocuments.some((doc) => doc.archived_at),
    [selectedDocuments],
  );
  const anySelectedNotArchived = useMemo(
    () => selectedDocuments.some((doc) => !doc.archived_at),
    [selectedDocuments],
  );

  useEffect(() => {
    const validIds = new Set(scopedDocuments.map((doc) => doc.id));
    setSelectedDocIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [scopedDocuments]);

  useEffect(() => {
    if (activeTab !== "documents") {
      setSelectedDocIds([]);
      setPeekingDocId(null);
      setShowConnectorRunsPanel(false);
      setShowRetrievalAuditPanel(false);
    }
  }, [activeTab]);

  const activeTasksCount = useMemo(
    () =>
      connectorRuns.filter(
        (run) => run.status === "running" || run.status === "pending",
      ).length,
    [connectorRuns],
  );

  const totalDocs = scopedDocuments.length;
  const completedDocsValue = scopedDocuments.filter(
    (doc) => doc.status === "completed",
  ).length;
  const processingDocsValue = scopedDocuments.filter(
    (doc) => doc.status === "processing" || doc.status === "pending",
  ).length;
  const failedDocsValue = scopedDocuments.filter(
    (doc) => doc.status === "failed",
  ).length;
  const quarantinedDocsValue = scopedDocuments.filter(
    (doc) => doc.status === "quarantined",
  ).length;
  const totalChunksValue = scopedDocuments.reduce(
    (sum, doc) => sum + (doc.chunk_count || 0),
    0,
  );

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId) || null,
    [datasets, selectedDatasetId],
  );

  const datasetLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const dataset of datasets) {
      map[dataset.id] = dataset.name;
    }
    return map;
  }, [datasets]);

  const retrievalDatasetIds = useMemo(
    () => datasets.map((dataset) => dataset.id).filter(Boolean),
    [datasets],
  );

  const handleDatasetScopeChange = useCallback((value: string) => {
    setDatasetScope(value);
    setFolderPath(null);
  }, []);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files?.length) return;

      try {
        await uploadDocuments(Array.from(files));
        toast.success(t("toasts.uploadSuccess", { count: files.length }));
        await loadDocuments();
      } catch (err) {
        toast.error(formatApiError(err, t("toasts.uploadFailed")));
      }
    },
    [loadDocuments, t, uploadDocuments],
  );

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedDocIds((prev) => {
      if (allVisibleSelected) return [];
      const next = new Set(prev);
      for (const doc of paginatedDocuments) {
        next.add(doc.id);
      }
      return Array.from(next);
    });
  }, [allVisibleSelected, paginatedDocuments]);

  const runBatchLifecycle = useCallback(
    async (action: "enable" | "disable" | "archive" | "unarchive") => {
      if (selectedDocIds.length === 0) return;

      setBatchLifecycleWorking(true);
      try {
        const lifecycleAction = {
          enable: documentApi.batchEnable,
          disable: documentApi.batchDisable,
          archive: documentApi.batchArchive,
          unarchive: documentApi.batchUnarchive,
        }[action];
        const result = await lifecycleAction(selectedDocIds);
        toast.success(
          t(`toasts.batchLifecycle.${action}`, {
            count: result.updated,
          }),
        );
        const rejected =
          (result.denied?.length ?? 0) +
          (result.not_found?.length ?? 0) +
          (result.conflicts?.length ?? 0);
        if (rejected > 0) {
          toast.warning(`${rejected} 份文档未处理（拒绝、未找到或冲突）`);
        }
        await loadDocuments();
      } catch (err) {
        toast.error(formatApiError(err, t("toasts.batchLifecycleFailed")));
      } finally {
        setBatchLifecycleWorking(false);
      }
    },
    [loadDocuments, selectedDocIds, t],
  );

  const runBatchReingest = useCallback(async () => {
    if (selectedDocIds.length === 0) return;

    setBatchReingestWorking(true);
    try {
      const result = await documentApi.batchReingest({
        document_ids: selectedDocIds,
        replace: false,
        force: true,
        skip_if_unchanged: false,
      });
      toast.success(
        t("toasts.reingestQueued", {
          count:
            typeof result.queued === "number"
              ? result.queued
              : selectedDocIds.length,
        }),
      );
      setSelectedDocIds([]);
      await loadDocuments();
    } catch (err) {
      toast.error(formatApiError(err, t("toasts.reingestFailed")));
    } finally {
      setBatchReingestWorking(false);
    }
  }, [loadDocuments, selectedDocIds, t]);

  const confirmBatchDelete = useCallback(async () => {
    if (selectedDocIds.length === 0) return;

    setBatchDeleting(true);
    try {
      await documentApi.batchDelete(selectedDocIds);
      setSelectedDocIds([]);
      await loadDocuments();
    } catch (err) {
      toast.error(formatApiError(err, t("toasts.batchDeleteFailed")));
    } finally {
      setBatchDeleting(false);
      setBatchDeleteOpen(false);
    }
  }, [loadDocuments, selectedDocIds, t]);

  const peekingDoc = useMemo(
    () => scopedDocuments.find((doc) => doc.id === peekingDocId) ?? null,
    [peekingDocId, scopedDocuments],
  );

  useEffect(() => {
    if (peekingDocId && !peekingDoc) setPeekingDocId(null);
  }, [peekingDoc, peekingDocId]);

  const closeDetail = useCallback(() => {
    setPeekingDocId(null);
  }, []);

  const restoreDetailFocus = useCallback(() => {
    const trigger = detailTriggerRef.current;
    if (!trigger) return;
    requestAnimationFrame(() => {
      if (trigger.isConnected) trigger.focus();
    });
  }, []);

  const openDetail = useCallback(
    (doc: Document, trigger?: HTMLElement | null) => {
      detailTriggerRef.current =
        trigger ??
        (globalThis.document?.activeElement as HTMLElement | null) ??
        null;
      setPeekingDocId(doc.id);
      setShowConnectorRunsPanel(false);
      setShowRetrievalAuditPanel(false);
    },
    [],
  );

  const openOriginal = useCallback(
    (doc: Document) => {
      setPeekingDocId(null);
      setShowConnectorRunsPanel(false);
      setShowRetrievalAuditPanel(false);
      openDocument(doc.id, undefined, undefined, { activeTab: "preview" });
    },
    [openDocument],
  );

  const scopeMode =
    activeTab === "documents"
      ? "documents"
      : activeTab === "retrieval"
        ? "retrieval"
        : "settings";

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "documents", label: t("tabs.documents.label") },
    { key: "retrieval", label: t("tabs.retrieval.label") },
    { key: "settings", label: t("tabs.settings.label") },
  ];

  const openChunkManager = useCallback(
    (id: string) => {
      openDocument(id, undefined, undefined, { activeTab: "chunks" });
      setPeekingDocId(null);
      setShowConnectorRunsPanel(false);
      setShowRetrievalAuditPanel(false);
    },
    [openDocument],
  );

  const scopePanel = (
    <KnowledgeScopePanel
      mode={scopeMode}
      surface="embedded"
      datasets={datasets}
      datasetsLoading={datasetsLoading}
      datasetScope={datasetScope}
      datasetAllValue={DATASET_ALL}
      selectedDatasetId={selectedDatasetId}
      lifecycleFilter={lifecycleFilter}
      setLifecycleFilter={setLifecycleFilter}
      folderPath={folderPath}
      setFolderPath={setFolderPath}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      totalDocs={totalDocs}
      completedDocsValue={completedDocsValue}
      processingDocsValue={processingDocsValue}
      failedDocsValue={failedDocsValue}
      quarantinedDocsValue={quarantinedDocsValue}
      setDatasetScope={handleDatasetScopeChange}
    />
  );

  return (
    <AppFrame
      rightPanel={<DocumentViewerPanel />}
      withDocumentViewerPadding={activeTab !== "retrieval"}
    >
      <div className="relative h-full overflow-hidden bg-background">
        <WorkbenchScaffold
          className="relative z-10"
          title={t("header.title")}
          headerClassName="mx-auto w-full max-w-page px-0"
          header={
            <header
              data-testid="knowledge-page-toolbar"
              className="flex flex-col gap-2 border-b border-foreground/15 pb-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div className="min-w-0">
                <h1 className="text-title font-semibold text-foreground">
                  {t("header.title")}
                </h1>
                <p className="mt-0.5 truncate text-caption text-muted-foreground">
                  {t("header.description")}
                </p>
              </div>
            </header>
          }
          size="full"
          toolbar={
            <div className="mx-auto flex w-full max-w-page flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
                <div
                  role="tablist"
                  aria-label={t("header.title")}
                  className="flex items-center gap-1"
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setPeekingDocId(null);
                      }}
                      className={cn(
                        "min-h-11 border-b-2 px-2 pb-1.5 pt-1 text-compact transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:min-h-8",
                        activeTab === tab.key
                          ? "border-foreground font-medium text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
                <Link
                  href={
                    selectedDatasetId
                      ? `/knowledge/quarantine?datasetId=${encodeURIComponent(selectedDatasetId)}`
                      : "/knowledge/quarantine"
                  }
                  className="min-h-11 border-b-2 border-transparent px-2 pb-1.5 pt-1 text-compact text-muted-foreground transition-colors hover:text-foreground sm:min-h-8"
                >
                  隔离
                </Link>
                <Link
                  href={
                    selectedDatasetId
                      ? `/chunk-preview?dataset_id=${encodeURIComponent(selectedDatasetId)}`
                      : "/chunk-preview"
                  }
                  className="min-h-11 border-b-2 border-transparent px-2 pb-1.5 pt-1 text-compact text-muted-foreground transition-colors hover:text-foreground sm:min-h-8"
                >
                  分块
                </Link>
                <Link
                  href="/knowledge/feedback"
                  className="min-h-11 border-b-2 border-transparent px-2 pb-1.5 pt-1 text-compact text-muted-foreground transition-colors hover:text-foreground sm:min-h-8"
                >
                  反馈
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="max-sm:w-11 max-sm:px-0 lg:hidden"
                  aria-label="筛选"
                  title="筛选"
                  onClick={() => setMobileScopeOpen(true)}
                >
                  <Filter className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">筛选</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden lg:inline-flex"
                  onClick={() => setDesktopScopeCollapsed((prev) => !prev)}
                  aria-label={
                    desktopScopeCollapsed
                      ? t("actions.showScope")
                      : t("actions.hideScope")
                  }
                >
                  {desktopScopeCollapsed ? (
                    <Maximize2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Minimize2 className="size-3.5" aria-hidden="true" />
                  )}
                  {desktopScopeCollapsed
                    ? t("actions.showScope")
                    : t("actions.hideScope")}
                </Button>

                {activeTab === "retrieval" ? (
                  <Button
                    type="button"
                    variant={showRetrievalAuditPanel ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      setShowConnectorRunsPanel(false);
                      setPeekingDocId(null);
                      setShowRetrievalAuditPanel((prev) => !prev);
                    }}
                  >
                    <Activity className="size-3.5" aria-hidden="true" />
                    索引审计
                  </Button>
                ) : null}

                {activeTab === "documents" ? (
                  <>
                    <Button
                      type="button"
                      variant={
                        showConnectorRunsPanel || activeTasksCount > 0
                          ? "secondary"
                          : "ghost"
                      }
                      size="sm"
                      className="max-sm:w-11 max-sm:px-0"
                      aria-label={activeTasksCount ? `${activeTasksCount} 个任务进行中` : "任务历史"}
                      title="任务历史"
                      onClick={() => {
                        setShowRetrievalAuditPanel(false);
                        setShowConnectorRunsPanel((prev) => {
                          const next = !prev;
                          if (next) setPeekingDocId(null);
                          return next;
                        });
                      }}
                    >
                      {activeTasksCount > 0 ? (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <History className="size-3.5" aria-hidden="true" />
                      )}
                      <span className="hidden sm:inline">{activeTasksCount > 0
                        ? `${activeTasksCount} 个任务进行中`
                        : "任务历史"}</span>
                    </Button>

                    <KnowledgeWorkbenchActions
                      datasets={datasets}
                      datasetsLoading={datasetsLoading}
                      selectedDatasetId={selectedDatasetId}
                      datasetDefaultValue={DATASET_ALL}
                      handleFileUpload={handleFileUpload}
                      uploadDocumentFromUrl={uploadDocumentFromUrl}
                      loadDocuments={loadDocuments}
                      loadConnectorRuns={loadConnectorRuns}
                      onConnectorRunCreated={() => {
                        setShowConnectorRunsPanel(true);
                        setPeekingDocId(null);
                        setActiveTab("documents");
                      }}
                    />

                    <div className="inline-flex items-center border border-border">
                      <IconButton
                        label={t("actions.viewGrid")}
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        aria-pressed={viewMode === "grid"}
                        onClick={() => setViewMode("grid")}
                      >
                        <LayoutGrid className="size-3.5" />
                      </IconButton>
                      <IconButton
                        label={t("actions.viewList")}
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        aria-pressed={viewMode === "list"}
                        onClick={() => setViewMode("list")}
                      >
                        <ListIcon className="size-3.5" />
                      </IconButton>
                    </div>
                  </>
                ) : null}

                {activeTab === "settings" ? (
                  <>
                    <Button
                      type="button"
                      variant={showConnectorRunsPanel ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setShowRetrievalAuditPanel(false);
                        setShowConnectorRunsPanel((prev) => {
                          const next = !prev;
                          if (next) setPeekingDocId(null);
                          return next;
                        });
                      }}
                    >
                      <History className="size-3.5" aria-hidden="true" />
                      任务历史
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setActiveTab("documents")}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      导入/新增
                    </Button>
                  </>
                ) : null}

                <IconButton
                  label={t("actions.refresh")}
                  variant="outline"
                  onClick={() => detachPromise(loadDocuments())}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={cn("size-3.5", isLoading && "animate-spin")}
                  />
                </IconButton>
              </div>
            </div>
          }
          toolbarClassName="px-0 py-2"
          bodyClassName="min-h-0 pb-4"
          paneGroupClassName="gap-0 overflow-hidden"
          mainPaneClassName="rounded-none! border-0! bg-transparent! shadow-none!"
          mainPaneBodyClassName={cn(
            "bg-transparent",
            activeTab === "retrieval"
              ? "overflow-y-auto p-4"
              : "overflow-hidden! p-0!",
          )}
        >
          <div
            ref={mainPaneSentinelRef}
            className="h-0 w-0"
            aria-hidden="true"
          />

          <div className="mx-auto flex h-full min-h-0 w-full max-w-page">
            {!desktopScopeCollapsed && activeTab !== "settings" ? (
              <aside className="hidden w-[200px] shrink-0 flex-col overflow-hidden border-r border-border lg:flex">
                {scopePanel}
              </aside>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {activeTab === "documents" ? (
                <KnowledgeDocumentsPanel
                  embedded
                  isLoading={isLoading}
                  documents={scopedDocuments}
                  filteredDocuments={paginatedDocuments}
                  filteredDocumentsAll={filteredDocuments}
                  totalDocumentsCount={filteredDocuments.length}
                  datasets={datasets}
                  selectedDatasetId={selectedDatasetId}
                  datasetLabelById={datasetLabelById}
                  hasActiveFilters={
                    Boolean(docFilter.trim()) ||
                    statusFilter !== "all" ||
                    lifecycleFilter !== "active" ||
                    Boolean(folderPath)
                  }
                  onSwitchToAllDatasets={() => {
                    setDatasetScope(DATASET_ALL);
                    setFolderPath(null);
                  }}
                  docFilter={docFilter}
                  setDocFilter={setDocFilter}
                  onClearFilters={() => {
                    setDocFilter("");
                    setStatusFilter("all");
                    setLifecycleFilter("active");
                    setFolderPath(null);
                  }}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  setSortKey={setSortKey}
                  setSortDir={setSortDir}
                  viewMode={viewMode}
                  docGridColumns={docGridColumns}
                  docsGridVirtualizer={docsGridVirtualizer}
                  docsTableVirtualizer={docsTableVirtualizer}
                  page={documentsPage}
                  pageSize={DOCUMENTS_PAGE_SIZE}
                  pageCount={documentsPageCount}
                  onPageChange={setDocumentsPage}
                  selectedDocIds={selectedDocIds}
                  setSelectedDocIds={setSelectedDocIds}
                  selectedSet={selectedSet}
                  allVisibleSelected={allVisibleSelected}
                  toggleSelectAllVisible={toggleSelectAllVisible}
                  toggleDocSelection={toggleDocSelection}
                  batchDeleteOpen={batchDeleteOpen}
                  setBatchDeleteOpen={setBatchDeleteOpen}
                  batchDeleting={batchDeleting}
                  confirmBatchDelete={confirmBatchDelete}
                  batchLifecycleWorking={batchLifecycleWorking}
                  batchReingestWorking={batchReingestWorking}
                  runBatchReingest={runBatchReingest}
                  runBatchLifecycle={runBatchLifecycle}
                  anySelectedDisabled={anySelectedDisabled}
                  anySelectedEnabled={anySelectedEnabled}
                  anySelectedArchived={anySelectedArchived}
                  anySelectedNotArchived={anySelectedNotArchived}
                  deleteDocument={deleteDocument}
                  onPeek={openChunkManager}
                  onOpenDetail={openDetail}
                  onOpenOriginal={openOriginal}
                  onScrollContainerChange={setDocumentsScrollEl}
                />
              ) : null}

              {activeTab === "retrieval" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <RetrievePreviewPanel
                    selectedDatasetId={selectedDatasetId}
                    availableDatasetIds={retrievalDatasetIds}
                    className="h-full border-0 bg-transparent p-0 shadow-none"
                  />
                </div>
              ) : null}

              {activeTab === "settings" ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <KnowledgeSettingsPanel
                    selectedDatasetId={selectedDatasetId}
                    selectedDataset={selectedDataset}
                    datasets={datasets}
                    datasetsLoading={datasetsLoading}
                    datasetAllValue={DATASET_ALL}
                    onDatasetScopeChange={handleDatasetScopeChange}
                    settingsSidebarCollapsed={desktopScopeCollapsed}
                    onGoToRetrievalTest={() => setActiveTab("retrieval")}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="xl:hidden">
            <WorkbenchPanelDialog
              open={mobileScopeOpen}
              onOpenChange={setMobileScopeOpen}
              title={t("dialogs.scope.title")}
              className="lg:hidden"
            >
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {scopePanel}
              </div>
            </WorkbenchPanelDialog>
          </div>
        </WorkbenchScaffold>

        <Sheet
          open={showConnectorRunsPanel}
          onOpenChange={setShowConnectorRunsPanel}
        >
          <SheetContent
            side="right"
            overlayClassName="bg-transparent"
            className="flex w-[min(480px,100vw)] flex-col gap-0 border-l border-border bg-surface p-0 shadow-none sm:max-w-[480px]"
          >
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-title-sm">任务历史</SheetTitle>
              <SheetDescription className="text-caption text-muted-foreground">
                查看连接器任务的进度，并取消、恢复或重试失败任务。
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <KnowledgeConnectorRunsPanel
                selectedDatasetId={selectedDatasetId}
                connectorRuns={connectorRuns}
                connectorRunsLoading={connectorRunsLoading}
                onCancelConnectorRun={cancelConnectorRun}
                onResumeConnectorRun={resumeConnectorRun}
                onRetryFailedConnectorRun={retryFailedConnectorRun}
                onLoadConnectorRuns={loadConnectorRuns}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet
          open={showRetrievalAuditPanel}
          onOpenChange={setShowRetrievalAuditPanel}
        >
          <SheetContent
            side="right"
            overlayClassName="bg-transparent"
            className="flex w-[min(420px,100vw)] flex-col gap-0 border-l border-border bg-surface p-0 shadow-none sm:max-w-[420px]"
          >
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-title-sm">索引审计</SheetTitle>
              <SheetDescription className="text-caption text-muted-foreground">
                当前数据集的索引一致性检查（Postgres ↔ 向量库）。
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <KnowledgeRetrievalPanel
                selectedDatasetId={selectedDatasetId}
                aggregateDocuments={totalDocs}
                aggregateChunks={totalChunksValue}
                compact
              />
            </div>
          </SheetContent>
        </Sheet>

        <KnowledgeDocumentDrawer
          doc={peekingDoc}
          open={Boolean(peekingDoc)}
          onOpenChange={(open) => {
            if (!open) closeDetail();
          }}
          onOpenOriginal={openOriginal}
          onAfterClose={restoreDetailFocus}
        />
      </div>
    </AppFrame>
  );
}
