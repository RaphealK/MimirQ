import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
}

function readOperationSource() {
  return readSource("operation-page-client.tsx");
}

describe("ingestion operation engineering layout", () => {
  it("uses the shared page shell inside a 720px single column", () => {
    const src = readOperationSource();

    expect(src).toContain('data-ingestion-operation-root="true"');
    expect(src).toContain('data-ingestion-operation-workspace="true"');
    expect(src).toContain("<PageHeader");
    expect(src).toContain("<PageBody");
    expect(src).toContain("max-w-[720px]");
    expect(src).toContain('<IngestionViewSwitch compact tone="info" />');

    expect(src).not.toContain("max-w-[1680px]");
    expect(src).not.toContain("OPERATION_BACKGROUND_CLASS");
    expect(src).not.toContain("radial-gradient");
    expect(src).not.toContain("xl:grid-cols-[300px_minmax(0,1fr)]");
  });

  it("keeps one secondary tab row with real sibling-route entries", () => {
    const src = readOperationSource();
    const switchSource = readSource("view-switch.tsx");

    expect(
      src.match(/<IngestionViewSwitch compact tone="info" \/>/g) ?? [],
    ).toHaveLength(1);
    expect(switchSource).toContain('role="tablist"');
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
      expect(switchSource).toContain(`route: "${route}"`);
    }
    expect(switchSource).toContain('params.set("mode", "execution-monitor")');
    expect(switchSource).toContain('params.delete("mode")');
    expect(switchSource).toContain("datasetId");
    expect(switchSource).toContain("dataset_id");
  });

  it("structures the three decisions with visible numbering", () => {
    const src = readOperationSource();

    expect(src).toContain('data-ingestion-target-section="true"');
    expect(src).toContain('data-ingestion-file-stage="true"');
    expect(src).toContain('data-ingestion-pipeline="true"');
    for (const number of ["①", "②", "③"]) {
      expect(src).toContain(number);
    }
    for (const heading of ["目标数据集", "文件来源", "执行路径"]) {
      expect(src).toContain(heading);
    }
  });

  it("keeps every real ingestion source and its existing parameters", () => {
    const src = readOperationSource();

    for (const source of ["local", "folder", "url", "object", "api"]) {
      expect(src).toContain(`value: "${source}"`);
    }
    expect(src).toContain('SourceConfiguration source="folder"');
    expect(src).toContain('SourceConfiguration source="url"');
    expect(src).toContain('SourceConfiguration source="object"');
    expect(src).toContain('SourceConfiguration source="api"');

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
    expect(src).toContain(
      'uploadFiles(draft.executionMode === "upload_only" ? "upload_only" : "ingest")',
    );
    expect(src).toContain("buildPipeline(draft)");
    expect(src).toContain("normalizeChunkStrategy(draft.chunkStrategy)");
  });

  it("merges presets and clickable nodes onto the same legal endpoints", () => {
    const src = readOperationSource();

    expect(src).toContain("<StepFlow");
    expect(src).toContain("onStepClick={handleStepClick}");
    expect(src).toContain('name="ingestion-execution-mode"');
    for (const value of ["upload_only", "parse_only", "full_index"]) {
      expect(src).toContain(`value="${value}"`);
    }
    for (const preset of ["仅登记", "入库并解析", "完整入库"]) {
      expect(src).toContain(preset);
    }

    expect(src).toContain('register: "upload_only"');
    expect(src).toContain('parse: "parse_only"');
    expect(src).toContain('govern: "full_index"');
    expect(src).toContain('index: "full_index"');
    expect(src).toContain("治理没有独立执行接口");
    expect(src).toContain("不会新建治理单独终点");

    expect(src).not.toContain("governance_only");
    expect(src).not.toContain('executionMode: "govern"');
  });

  it("keeps exactly one preflight and one submit action in the footer", () => {
    const src = readOperationSource();

    expect(src.match(/data-ingestion-action-bar="true"/g) ?? []).toHaveLength(
      1,
    );
    expect(src.match(/data-ingestion-preflight="true"/g) ?? []).toHaveLength(1);
    expect(src).not.toContain("预检结果");
    expect(src).toContain("正在提交");
    expect(src).toContain("再次提交");
  });

  it("binds advanced settings to the legacy draft and pipeline fields", () => {
    const src = readOperationSource();

    expect(src).toContain('data-ingestion-advanced-settings="true"');
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
      expect(src).toContain(field);
    }
    for (const pipelineField of [
      "chunk_size: draft.chunkSize",
      "chunk_overlap: draft.chunkOverlap",
      "near_dedup_enabled",
      "persist_parsed_content",
      "chunk_vector_enabled",
      "bm25_index_enabled",
    ]) {
      expect(src).toContain(pipelineField);
    }
  });

  it("removes the old dashboard, task list, and decorative hero shell", () => {
    const src = readOperationSource();

    expect(src).not.toContain('data-ingestion-control-strip="true"');
    expect(src).not.toContain('data-ingestion-status-rail="true"');
    expect(src).not.toContain('data-ingestion-task-builder="true"');
    expect(src).not.toContain('data-ingestion-task-list-card="true"');
    expect(src).not.toContain("function TaskListCard(");
    expect(src).not.toContain("OPERATION_HERO_PANEL_CLASS");
    expect(src).not.toContain("rounded-[28px]");
  });
});
