import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
}

function readOperationSource() {
  return readSource("operation-page-client.tsx");
}

/**
 * Structural assertions must not depend on the formatter's line wrapping or
 * quote style. Collapse whitespace and normalize quotes before matching JSX
 * and expressions; user-facing copy is still asserted against the raw source.
 */
function structuralSource(source: string) {
  return source.replace(/\s+/g, " ").replace(/'/g, '"');
}

describe("ingestion operation engineering layout", () => {
  it("uses the shared page shell inside a 720px single column", () => {
    const src = readOperationSource();
    const compact = structuralSource(src);

    expect(compact).toContain('data-ingestion-operation-root="true"');
    expect(compact).toContain('data-ingestion-operation-workspace="true"');
    expect(compact).toContain("<PageHeader");
    expect(compact).toContain("<PageBody");
    expect(compact).toContain("max-w-[720px]");
    expect(compact).toContain('<IngestionViewSwitch compact tone="info" />');

    expect(compact).not.toContain("max-w-[1680px]");
    expect(compact).not.toContain("OPERATION_BACKGROUND_CLASS");
    expect(compact).not.toContain("radial-gradient");
    expect(compact).not.toContain("xl:grid-cols-[300px_minmax(0,1fr)]");
  });

  it("keeps one secondary tab row with real sibling-route entries", () => {
    const src = readOperationSource();
    const switchSource = readSource("view-switch.tsx");
    const compact = structuralSource(src);
    const switchCompact = structuralSource(switchSource);

    expect(
      src.match(/<IngestionViewSwitch compact tone="info" \/>/g) ?? [],
    ).toHaveLength(1);
    expect(switchCompact).toContain('role="tablist"');
    for (const label of [
      "新建任务",
      "文档解析",
      "数据治理",
      "切块预览",
      "任务监控",
    ]) {
      expect(switchSource).toContain(label);
    }
    for (const route of ["/parsing", "/data-governance", "/chunk-preview"]) {
      expect(switchCompact).toContain(`route: "${route}"`);
    }
    expect(switchCompact).toContain('params.set("mode", "execution-monitor")');
    expect(switchCompact).toContain('params.delete("mode")');
    expect(switchCompact).toContain("datasetId");
    expect(switchCompact).toContain("dataset_id");
    expect(compact).not.toContain("查看任务");
  });

  it("structures the three decisions with visible numbering", () => {
    const src = readOperationSource();
    const compact = structuralSource(src);

    expect(compact).toContain('data-ingestion-target-section="true"');
    expect(compact).toContain('data-ingestion-file-stage="true"');
    expect(compact).toContain('data-ingestion-pipeline="true"');
    for (const number of ["①", "②", "③"]) {
      expect(src).toContain(number);
    }
    for (const heading of ["目标数据集", "文件来源", "执行路径"]) {
      expect(src).toContain(heading);
    }
  });

  it("keeps every real ingestion source and its existing parameters", () => {
    const src = readOperationSource();
    const compact = structuralSource(src);

    for (const source of ["local", "folder", "url", "object", "api"]) {
      expect(compact).toContain(`value: "${source}"`);
    }
    for (const source of ["folder", "url", "object", "api"]) {
      expect(compact).toContain(`SourceConfiguration source="${source}"`);
    }

    for (const marker of [
      "选择本地文件夹",
      "URL 列表",
      "remote-documents.md",
      "Bucket（可选）",
      "对象前缀",
      "扩展名",
      "最大对象数",
      "API Payload",
      "api-payload.json",
    ]) {
      expect(src).toContain(marker);
    }
    expect(compact).toContain(
      'draft.executionMode === "upload_only" ? "upload_only" : "ingest"',
    );
    expect(compact).toContain("buildPipeline(draft)");
    expect(compact).toContain("normalizeChunkStrategy(draft.chunkStrategy)");
  });

  it("merges presets and clickable nodes onto the same legal endpoints", () => {
    const src = readOperationSource();
    const compact = structuralSource(src);

    expect(compact).toContain("<StepFlow");
    expect(compact).toContain("onStepClick={handleStepClick}");
    expect(compact).toContain('name="ingestion-execution-mode"');
    expect(compact).toContain("value={option.value}");
    for (const preset of ["仅登记", "入库并解析", "完整入库"]) {
      expect(src).toContain(preset);
    }

    expect(compact).toContain('register: "upload_only"');
    expect(compact).toContain('parse: "parse_only"');
    expect(compact).toContain('govern: "full_index"');
    expect(compact).toContain('index: "full_index"');
    expect(src).toContain("治理随完整入库执行");

    expect(compact).not.toContain("governance_only");
    expect(compact).not.toContain('executionMode: "govern"');
  });

  it("keeps upload-only blocked by source rather than by the current mode", () => {
    const compact = structuralSource(readOperationSource());

    expect(compact).toContain("uploadOnlySourceBlocked");
    expect(compact).toContain(
      'option.value === "upload_only" && uploadOnlySourceBlocked',
    );
    expect(compact).not.toContain(
      'option.value === "upload_only" && sourceExecutionBlocked',
    );
    expect(compact).toContain(
      'draft.executionMode === "upload_only" && uploadOnlySourceBlocked',
    );
  });

  it("keeps exactly one preflight, one count per surface, and one submit action", () => {
    const src = readOperationSource();
    const compact = structuralSource(src);

    expect(src.match(/data-ingestion-action-bar="true"/g) ?? []).toHaveLength(
      1,
    );
    expect(src.match(/data-ingestion-preflight="true"/g) ?? []).toHaveLength(1);
    expect(compact).toContain("正在提交");
    expect(compact).toContain("再次提交");
    expect(compact).toContain("解析并建索引");
    expect(compact).toContain("可以提交");

    expect(compact).not.toContain("预检结果");
    expect(compact).not.toContain("data-ingestion-source-summary");
    expect(compact).not.toContain("共 {rows.length} 个文件");
    expect(compact).not.toContain("将 ${pendingSourceCount} 项");
    expect(compact).not.toContain("下面的计数是当前数据集的真实聚合");
    expect(compact).not.toContain("不会改变提交参数");
  });

  it("binds advanced settings to the legacy draft and pipeline fields", () => {
    const src = readOperationSource();
    const compact = structuralSource(src);

    expect(compact).toContain('data-ingestion-advanced-settings="true"');
    for (const label of [
      "高级设置",
      "入库模式",
      "标签",
      "目标目录",
      "重复处理",
      "解析器",
      "切块方式",
      "切块大小",
      "重叠字符",
    ]) {
      expect(src).toContain(label);
    }
    for (const field of [
      "ingestMode",
      "dedupStrategy",
      "parserBackend",
      "chunkStrategy",
      "chunkSize",
      "chunkOverlap",
      "tags",
      "collection",
    ]) {
      expect(compact).toContain(field);
    }
    for (const pipelineField of [
      "chunk_size: draft.chunkSize",
      "chunk_overlap: draft.chunkOverlap",
      "near_dedup_enabled",
      "persist_parsed_content",
      "chunk_vector_enabled",
      "bm25_index_enabled",
    ]) {
      expect(compact).toContain(pipelineField);
    }
  });

  it("removes the old dashboard, task list, and decorative hero shell", () => {
    const compact = structuralSource(readOperationSource());

    expect(compact).not.toContain('data-ingestion-control-strip="true"');
    expect(compact).not.toContain('data-ingestion-status-rail="true"');
    expect(compact).not.toContain('data-ingestion-task-builder="true"');
    expect(compact).not.toContain('data-ingestion-task-list-card="true"');
    expect(compact).not.toContain("function TaskListCard(");
    expect(compact).not.toContain("OPERATION_HERO_PANEL_CLASS");
    expect(compact).not.toContain("rounded-[28px]");
  });
});
