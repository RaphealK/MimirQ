// Source contract check only; this is not behavior coverage.
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const KNOWLEDGE_DIR = path.resolve(__dirname, "../../components/knowledge");

function readKnowledgeFile(name: string): string {
  return fs.readFileSync(path.join(KNOWLEDGE_DIR, name), "utf8");
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("knowledge route entry", () => {
  it("keeps app/knowledge/page.tsx as a thin wrapper (module boundary)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf8");
    expect(src).toContain("@/components/knowledge/knowledge-page");
  });

  it("keeps real URL state, flat shell and a single detail drawer host", () => {
    const pageSrc = readKnowledgeFile("knowledge-page.tsx");
    const drawerSrc = readKnowledgeFile("knowledge-document-drawer.tsx");
    const documentsSrc = readKnowledgeFile("knowledge-documents-panel.tsx");

    expect(pageSrc).toContain("parseKnowledgeQueryState");
    expect(pageSrc).toContain("serializeKnowledgeQueryState");
    expect(pageSrc).toContain("router.replace");
    expect(pageSrc).toContain('window.addEventListener("keydown"');
    expect(pageSrc).toContain(
      'withDocumentViewerPadding={activeTab !== "retrieval"}',
    );

    expect(pageSrc).toContain('data-testid="knowledge-page-toolbar"');
    expect(pageSrc).toContain('{t("header.title")}');
    expect(pageSrc).toContain('{t("header.description")}');
    expect(pageSrc).toContain("text-title font-semibold");
    expect(pageSrc).toContain("max-w-page");
    expect(pageSrc).toContain("w-[200px]");
    expect(pageSrc).toContain('paneGroupClassName="gap-0 overflow-hidden"');
    expect(pageSrc).not.toContain("backdrop-blur-none");
    expect(pageSrc).not.toContain("KNOWLEDGE_GLASS_CARD_CLASS");
    expect(pageSrc).not.toContain("bg-[linear-gradient");
    expect(pageSrc).not.toContain("shadow-soft");
    expect(pageSrc).not.toContain("documentScopeSummary");

    expect(countOccurrences(pageSrc, "<KnowledgeDocumentDrawer")).toBe(1);
    expect(countOccurrences(pageSrc, "<KnowledgeInspector")).toBe(0);
    expect(countOccurrences(drawerSrc, "<KnowledgeInspector")).toBe(1);
    expect(countOccurrences(documentsSrc, "KnowledgeInspector")).toBe(0);
    expect(drawerSrc).not.toContain("lastDocRef");
  });

  it("keeps the three query tabs plus real branch links without duplicated counts", () => {
    const pageSrc = readKnowledgeFile("knowledge-page.tsx");

    expect(pageSrc).toContain(
      '{ key: "documents", label: t("tabs.documents.label") }',
    );
    expect(pageSrc).toContain(
      '{ key: "retrieval", label: t("tabs.retrieval.label") }',
    );
    expect(pageSrc).toContain(
      '{ key: "settings", label: t("tabs.settings.label") }',
    );
    expect(pageSrc).toContain("setActiveTab(tab.key)");
    expect(pageSrc).toContain("/knowledge/quarantine");
    expect(pageSrc).toContain("/chunk-preview");
    expect(pageSrc).toContain("/knowledge/feedback");
    expect(pageSrc).toContain("selectedDatasetId");
    expect(pageSrc).not.toContain("Scope Navigator");

    expect(pageSrc).toContain("setDesktopScopeCollapsed((prev) => !prev)");
    expect(pageSrc).toContain("<KnowledgeWorkbenchActions");
    expect(pageSrc).toContain("onClick={() => detachPromise(loadDocuments())}");
    expect(pageSrc).toContain("showConnectorRunsPanel");
    expect(pageSrc).toContain("showRetrievalAuditPanel");
    expect(pageSrc).toContain("<KnowledgeConnectorRunsPanel");
    expect(pageSrc).toContain("<KnowledgeRetrievalPanel");
    expect(pageSrc).toContain("onCancelConnectorRun={cancelConnectorRun}");
    expect(pageSrc).toContain("onResumeConnectorRun={resumeConnectorRun}");
    expect(pageSrc).toContain(
      "onRetryFailedConnectorRun={retryFailedConnectorRun}",
    );
  });

  it("keeps the 40px virtual table, six sorts, stat strip and unique row actions", () => {
    const pageSrc = readKnowledgeFile("knowledge-page.tsx");
    const documentsSrc = readKnowledgeFile("knowledge-documents-panel.tsx");

    expect(pageSrc).toContain("estimateSize: () => 40");
    expect(documentsSrc).toContain("measureElement");
    expect(pageSrc).toContain("paginatedDocuments");
    expect(documentsSrc).toContain("StatStrip");
    expect(documentsSrc).toContain("DataTable");
    expect(documentsSrc).toContain("DataTableRow");
    expect(documentsSrc).toContain("DataTableActions");
    expect(documentsSrc).toContain("data-index={virtualRow.index}");
    expect(documentsSrc).toContain("docsTableVirtualizer.measureElement");

    for (const key of [
      "createdDesc",
      "createdAsc",
      "filenameAsc",
      "filenameDesc",
      "fileSizeDesc",
      "fileSizeAsc",
    ]) {
      expect(documentsSrc).toContain(`sort.${key}`);
    }

    expect(documentsSrc).toContain("table.emptyValue");
    expect(documentsSrc).toContain("formatChunkCount");
    expect(documentsSrc).toContain("formatDocumentSize");
    expect(documentsSrc).toContain("actions.moreActions");
    expect(documentsSrc).toContain("actions.openInspector");
    expect(documentsSrc).toContain("actions.previewContent");
    expect(documentsSrc).toContain("actions.healthCard");
    expect(documentsSrc).toContain("actions.deleteDocument");
    expect(documentsSrc).toContain("isInteractiveTarget");
    expect(documentsSrc).toContain(
      "onClick={(event) => event.stopPropagation()}",
    );
    expect(documentsSrc).toContain("filteredDocumentsAll");
    expect(documentsSrc).toContain("exportFilteredCsv");
    expect(
      countOccurrences(documentsSrc, "paginationFooter"),
    ).toBeGreaterThanOrEqual(4);
    expect(documentsSrc).not.toContain("DataTableEmpty");
    expect(documentsSrc).not.toContain("onKeyDownCapture");
  });

  it("keeps filter dimensions while only per-status counts remain in scope", () => {
    const scopeSrc = readKnowledgeFile("knowledge-scope-panel.tsx");

    expect(scopeSrc).toContain("data-knowledge-scope-panel");
    expect(scopeSrc).toContain("datasetScope");
    expect(scopeSrc).toContain("statusFilter");
    expect(scopeSrc).toContain("lifecycleFilter");
    expect(scopeSrc).toContain("folderPath");
    expect(scopeSrc).toContain("DatasetFolderTree");
    expect(scopeSrc).toContain('item.key === "all" ? null');
  });

  it("keeps document detail fields, source/quality and copy path in the inspector", () => {
    const inspectorSrc = readKnowledgeFile("knowledge-inspector.tsx");

    expect(inspectorSrc).toContain("selected.id || EMPTY_VALUE");
    expect(inspectorSrc).not.toContain("formatShortId");
    expect(inspectorSrc).toContain("getSourceTypeLabel");
    expect(inspectorSrc).toContain("getParseQualityPercent");
    expect(inspectorSrc).toContain("row.parseQualityLow");
    expect(inspectorSrc).toContain("toasts.copySourcePath");
    expect(inspectorSrc).toContain("actions.copySourcePath");
    expect(inspectorSrc).toContain("max={0}");
    expect(inspectorSrc).toContain("break-all whitespace-normal");
    expect(inspectorSrc).not.toContain(">文档详情<");
    expect(countOccurrences(inspectorSrc, 'label="分块"')).toBe(1);
  });

  it("keeps the knowledge surface free of legacy glass/marker scaffolding", () => {
    for (const file of [
      "knowledge-page.tsx",
      "knowledge-documents-panel.tsx",
      "knowledge-scope-panel.tsx",
      "knowledge-inspector.tsx",
      "knowledge-document-drawer.tsx",
    ]) {
      const src = readKnowledgeFile(file);
      expect(src).not.toContain("Source markers retained");
      expect(src).not.toContain("legacy source tests");
      expect(src).not.toContain("data-knowledge-empty-shelf");
      expect(src).not.toContain("radial-gradient");
      expect(src).not.toContain("backdrop-blur");
    }
  });

  it("preserves settings scope, model selection, save and verification behavior", () => {
    const settingsSrc = fs.readFileSync(
      path.join(KNOWLEDGE_DIR, "knowledge-settings-panel.tsx"),
      "utf8",
    );

    expect(settingsSrc).toContain("value={selectedScopeValue}");
    expect(settingsSrc).toContain("onValueChange={onDatasetScopeChange}");
    expect(settingsSrc).toContain("EMBEDDING_PRESETS.map((preset) =>");
    expect(settingsSrc).toContain("await datasetApi.update(selectedDatasetId");
    expect(settingsSrc).toContain("await settingsApi.update(draftConfig)");
    expect(settingsSrc).toContain("await retrievalApi.configHash(hashRequest)");
    expect(settingsSrc).toContain("queryKeys.datasets.exhaustive()");
    expect(settingsSrc).toContain("onClick={handleSaveDraft}");
    expect(settingsSrc).toContain("onClick={handleApplyRecommendedConfig}");
    expect(settingsSrc).toContain("onGoToRetrievalTest?.()");
    expect(settingsSrc).toContain("setGuideExpanded");
    expect(settingsSrc).toContain("setCurrentConfigOpen");
    expect(settingsSrc).toContain("配置范围");
    expect(settingsSrc).toContain("当前自定义模型");
    expect(settingsSrc).toContain("hasCustomEmbeddingModel");
    expect(settingsSrc).not.toContain("comparisonMetrics");
    expect(settingsSrc).not.toContain("当前配置预估效果");
    expect(settingsSrc).not.toContain("系统建议");
  });
});
