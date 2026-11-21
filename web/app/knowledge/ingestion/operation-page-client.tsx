"use client";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Cloud,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileType,
  Folder,
  Link as LinkIcon,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageBody } from "@/components/ui/page-body";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { StepFlow, type StepFlowStep } from "@/components/ui/step-flow";
import { Textarea } from "@/components/ui/textarea";
import { connectorApi, datasetApi, documentApi, settingsApi } from "@/lib/api";
import { formatApiError } from "@/lib/api-errors";
import { readClientStorage } from "@/lib/client-storage";
import { cn, detachPromise, formatFileSize } from "@/lib/utils";
import type {
  Dataset,
  Document,
  DocumentBatchUploadResponse,
  DocumentFolderNode,
  DocumentPipelineOptions,
} from "@/types";

import { IngestionViewSwitch } from "./view-switch";

const DRAFT_KEY = "mimirq.knowledge.ingestion.operation.draft";
const DEFAULT_COLLECTION = "default";
const NO_DATASET_FILE_BUCKET = "__mimirq_no_dataset__";
const EMPTY_FILES: File[] = [];
const PAGE_COLUMN_CLASS =
  "mx-auto flex min-h-full w-full max-w-[720px] flex-col";
const SECTION_CLASS = "border-b border-border py-5";
const SECTION_HEADER_CLASS = "flex items-baseline justify-between gap-3";
const FIELD_HINT_CLASS = "text-micro leading-4 text-muted-foreground";

type UploadSource = "local" | "folder" | "url" | "object" | "api";
type ParserBackend =
  "auto" | "docling" | "markitdown" | "deepdoc" | "csv" | "json" | "markdown";
type ChunkStrategy =
  "semantic" | "langchain_recursive" | "markdown" | "by_title";
type IngestMode = "append" | "replace" | "skip_duplicates";
type IngestExecutionMode = "upload_only" | "parse_only" | "full_index";
type TaskStatus = "idle" | "prechecking" | "uploading" | "completed" | "failed";
type OperationStageId = "register" | "parse" | "govern" | "index";
type SelectOption<T extends string> = {
  value: T;
  title: string;
  description: string;
  badge?: string;
};

type DraftState = {
  datasetId: string;
  syncDataset: boolean;
  ingestMode: IngestMode;
  executionMode: IngestExecutionMode;
  parserBackend: ParserBackend;
  chunkStrategy: ChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  dedupStrategy: string;
  tags: string;
  collection: string;
  errorPolicy: string;
  refreshStats: boolean;
  keepFailureTasks: boolean;
};

type DatasetIngestContext = Pick<DraftState, "tags" | "collection">;
type FileUploadState = "submitted" | "failed";

const DEFAULT_DRAFT: DraftState = {
  datasetId: "",
  syncDataset: false,
  ingestMode: "append",
  executionMode: "upload_only",
  parserBackend: "auto",
  chunkStrategy: "semantic",
  chunkSize: 600,
  chunkOverlap: 100,
  dedupStrategy: "content_hash",
  tags: "",
  collection: DEFAULT_COLLECTION,
  errorPolicy: "skip_failed",
  refreshStats: true,
  keepFailureTasks: true,
};

const SOURCE_OPTIONS: Array<{
  value: UploadSource;
  label: string;
  icon: LucideIcon;
  description: string;
}> = [
  {
    value: "local",
    label: "本地文件",
    icon: UploadCloud,
    description: "上传文件",
  },
  {
    value: "folder",
    label: "文件夹",
    icon: Folder,
    description: "批量导入文件夹",
  },
  {
    value: "url",
    label: "URL列表",
    icon: LinkIcon,
    description: "从链接批量导入",
  },
  {
    value: "object",
    label: "对象存储",
    icon: Cloud,
    description: "S3/OSS/MinIO 等",
  },
  {
    value: "api",
    label: "API导入",
    icon: Archive,
    description: "通过接口推送数据",
  },
];

const OPERATION_STAGES: Array<{
  id: OperationStageId;
  label: string;
  description: string;
}> = [
  { id: "register", label: "登记", description: "校验来源与文件" },
  { id: "parse", label: "解析", description: "提取正文与结构" },
  { id: "govern", label: "治理", description: "清洗、去重、切块" },
  { id: "index", label: "建索引", description: "向量与关键词索引" },
];

/**
 * The legacy backend exposes three terminal execution modes only:
 * upload_only (1), parse_only (1-2) and full_index (1-2-4).
 * Governance has no standalone endpoint, so both governance and index
 * nodes intentionally resolve to the existing full_index payload.
 */
const STAGE_EXECUTION_MODE: Record<OperationStageId, IngestExecutionMode> = {
  register: "upload_only",
  parse: "parse_only",
  govern: "full_index",
  index: "full_index",
};

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".md",
  ".markdown",
  ".docx",
  ".html",
  ".htm",
  ".txt",
  ".csv",
  ".xlsx",
  ".xls",
  ".json",
  ".zip",
];

const INGEST_MODE_OPTIONS: Array<SelectOption<IngestMode>> = [
  {
    value: "append",
    title: "追加导入",
    description: "保留现有数据，只写入本次文件。",
    badge: "默认",
  },
  {
    value: "skip_duplicates",
    title: "跳过重复",
    description: "发现重复文件时跳过，适合批量补充。",
    badge: "稳妥",
  },
  {
    value: "replace",
    title: "替换同名",
    description: "同名文件用新版本覆盖，适合重传修订。",
    badge: "谨慎",
  },
];
const EXECUTION_MODE_OPTIONS: Array<SelectOption<IngestExecutionMode>> = [
  {
    value: "upload_only",
    title: "仅登记",
    description: "仅登记到知识库（不解析），不启动解析队列。",
    badge: "默认",
  },
  {
    value: "parse_only",
    title: "入库并解析",
    description: "入库并解析（不建索引），可进入执行监控。",
    badge: "监控",
  },
  {
    value: "full_index",
    title: "完整入库",
    description: "完整入库（解析 + 索引），直接写入检索索引。",
    badge: "完整",
  },
];
const DEDUP_OPTIONS: Array<SelectOption<string>> = [
  {
    value: "content_hash",
    title: "内容哈希",
    description: "相同内容自动跳过，推荐默认使用。",
    badge: "推荐",
  },
  {
    value: "filename",
    title: "文件名",
    description: "按同名文件判断重复。",
  },
  {
    value: "none",
    title: "不检查",
    description: "直接写入，适合临时或隔离数据。",
  },
];
const PARSER_OPTIONS: Array<SelectOption<ParserBackend>> = [
  {
    value: "auto",
    title: "自动",
    description: "按文件类型自动选择解析器。",
    badge: "默认",
  },
  { value: "docling", title: "Docling", description: "结构化文档解析。" },
  {
    value: "markitdown",
    title: "MarkItDown",
    description: "轻量 Markdown 转换。",
  },
  { value: "deepdoc", title: "DeepDoc", description: "复杂版式与扫描件解析。" },
  { value: "csv", title: "CSV", description: "按表格结构解析 CSV。" },
  { value: "json", title: "JSON", description: "按 JSON 结构解析。" },
  {
    value: "markdown",
    title: "Markdown",
    description: "按 Markdown 结构解析。",
  },
];
const CHUNK_STRATEGY_OPTIONS: Array<SelectOption<ChunkStrategy>> = [
  {
    value: "semantic",
    title: "语义切块",
    description: "按语义边界切分，提交时归一化为 langchain_recursive。",
    badge: "默认",
  },
  {
    value: "langchain_recursive",
    title: "递归切块",
    description: "按分隔符递归切分，提交时保持原值。",
  },
  {
    value: "markdown",
    title: "Markdown 切块",
    description: "按 Markdown 标题层级切分。",
  },
  {
    value: "by_title",
    title: "按标题切块",
    description: "按标题切分，提交时归一化为 markdown。",
  },
];

function isIngestExecutionMode(value: unknown): value is IngestExecutionMode {
  return (
    value === "upload_only" || value === "parse_only" || value === "full_index"
  );
}

function loadDraft(): DraftState {
  if (globalThis.window === undefined) return DEFAULT_DRAFT;
  try {
    const raw = readClientStorage(DRAFT_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw) as Partial<DraftState>;
    const draft = { ...DEFAULT_DRAFT, ...parsed };
    if (
      !Object.prototype.hasOwnProperty.call(parsed, "executionMode") ||
      !isIngestExecutionMode(draft.executionMode)
    ) {
      draft.executionMode = DEFAULT_DRAFT.executionMode;
      draft.syncDataset = DEFAULT_DRAFT.syncDataset;
    }
    return draft;
  } catch {
    return DEFAULT_DRAFT;
  }
}

function fileKey(file: File) {
  const path =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;
  return `${path}:${file.size}:${file.lastModified}`;
}

function fileUploadName(file: File) {
  return String(
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name,
  );
}

function fileRelativeFolder(file: File) {
  const path = fileUploadName(file);
  if (!path.includes("/")) return "";
  return path.split("/").slice(0, -1).join("/").trim();
}

function formatFileType(file: File) {
  const ext = file.name.split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOption(value: unknown) {
  return String(value || "").trim();
}

function normalizeListText(value: string) {
  return value
    .split(/[,\n，、]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSelectOptionTitle<T extends string>(
  options: Array<SelectOption<T>>,
  value: T,
) {
  return options.find((option) => option.value === value)?.title ?? value;
}

function SelectOptionBody({
  badge,
  description,
  title,
}: Readonly<{
  badge?: string;
  description: string;
  title: string;
}>) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-compact font-semibold leading-4 text-foreground">
          {title}
        </span>
        {badge ? (
          <span className="shrink-0 rounded-[4px] border border-border bg-muted px-1.5 py-0.5 text-micro font-medium leading-none text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 text-micro leading-4 text-muted-foreground">
        {description}
      </span>
    </span>
  );
}

function DatasetOptionBody({ dataset }: Readonly<{ dataset: Dataset }>) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-compact font-semibold leading-4 text-foreground">
        {dataset.name}
      </span>
      <span className="font-mono text-micro leading-4 text-muted-foreground">
        ID {datasetShortId(dataset)}
      </span>
    </span>
  );
}

function getDocumentUserTags(document: Document): string[] {
  const metadata = document.metadata;
  if (!isRecord(metadata)) return [];
  const user = metadata.user;
  const rawTags = isRecord(user) ? user.tags : metadata.tags;
  if (Array.isArray(rawTags)) {
    return rawTags.map(normalizeOption).filter(Boolean);
  }
  if (typeof rawTags === "string") return normalizeListText(rawTags);
  return [];
}

function collectTagOptions(documents: Document[], draftTags: string): string[] {
  const options = new Set<string>();
  for (const tag of normalizeListText(draftTags)) options.add(tag);
  for (const document of documents) {
    for (const tag of getDocumentUserTags(document)) options.add(tag);
  }
  return Array.from(options).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function collectFolderPaths(root?: DocumentFolderNode | null): string[] {
  if (!root) return [];
  const out: string[] = [];
  const stack = [...(root.children || [])].reverse();
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    const path = normalizeOption(node.path);
    if (path) out.push(path);
    for (const child of [...(node.children || [])].reverse()) stack.push(child);
  }
  return out;
}

function collectCollectionOptions(
  root: DocumentFolderNode | null | undefined,
  files: File[],
  currentCollection: string,
): string[] {
  const options = new Set<string>([DEFAULT_COLLECTION]);
  for (const path of collectFolderPaths(root)) options.add(path);
  for (const file of files) {
    const folder = fileRelativeFolder(file);
    if (folder) options.add(folder);
  }
  const normalizedCurrent = normalizeOption(currentCollection);
  if (normalizedCurrent) options.add(normalizedCurrent);
  return Array.from(options).sort((a, b) => {
    if (a === DEFAULT_COLLECTION) return -1;
    if (b === DEFAULT_COLLECTION) return 1;
    return a.localeCompare(b, "zh-CN");
  });
}

function getFileIcon(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (["xlsx", "xls", "csv"].includes(ext || "")) return FileSpreadsheet;
  if (["zip"].includes(ext || "")) return FileArchive;
  if (["md", "markdown", "txt", "html", "docx", "pdf"].includes(ext || ""))
    return FileText;
  return FileType;
}

function shouldBuildIndexes(draft: DraftState) {
  return draft.executionMode === "full_index";
}

function shouldOpenExecutionMonitor(
  draft: DraftState,
  mode: "upload_only" | "ingest",
) {
  return mode === "ingest" && draft.executionMode === "parse_only";
}

function buildPipeline(draft: DraftState): DocumentPipelineOptions {
  return {
    chunk_size: draft.chunkSize,
    chunk_overlap: draft.chunkOverlap,
    near_dedup_enabled: draft.dedupStrategy !== "none",
    persist_parsed_content: draft.executionMode !== "upload_only",
    chunk_vector_enabled: shouldBuildIndexes(draft),
    bm25_index_enabled: shouldBuildIndexes(draft),
  };
}

function normalizeChunkStrategy(strategy: ChunkStrategy) {
  if (strategy === "semantic") return "langchain_recursive";
  if (strategy === "by_title") return "markdown";
  return strategy;
}

function datasetShortId(dataset?: Dataset | null) {
  return dataset?.id ? String(dataset.id).slice(0, 18).toUpperCase() : "--";
}

function parseLineList(raw: string, max = 100) {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of raw.split(/[\n,;]+/)) {
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
    if (values.length >= max) break;
  }
  return values;
}

function parseUrlList(raw: string) {
  return parseLineList(raw, 50).filter((value) => /^https?:\/\//i.test(value));
}

function parseExtensions(raw: string) {
  const extensions = parseLineList(raw, 20)
    .map((value) => value.toLowerCase())
    .map((value) => (value.startsWith(".") ? value : `.${value}`))
    .filter((value) => /^\.[a-z0-9]{1,12}$/i.test(value));
  return extensions.length ? extensions : [".pdf", ".md", ".txt"];
}

function apiPayloadFileType(filename: string) {
  const ext = filename.split(".").pop()?.trim().toLowerCase();
  return ext || "json";
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: Readonly<{
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-caption font-medium text-foreground"
      >
        {label}
      </label>
      {children}
      {hint ? <p className={FIELD_HINT_CLASS}>{hint}</p> : null}
    </div>
  );
}

export default function KnowledgeIngestionOperationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeDatasetId = searchParams.get("datasetId") || "";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const previousDatasetIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT);
  const [datasetIngestContextById, setDatasetIngestContextById] = useState<
    Record<string, DatasetIngestContext>
  >({});
  const [source, setSource] = useState<UploadSource>("local");
  const [filesByDatasetId, setFilesByDatasetId] = useState<
    Record<string, File[]>
  >({});
  const [urlList, setUrlList] = useState("");
  const [urlFilename, setUrlFilename] = useState("");
  const [objectBucket, setObjectBucket] = useState("");
  const [objectPrefix, setObjectPrefix] = useState("");
  const [objectExtensions, setObjectExtensions] = useState(".pdf, .md, .txt");
  const [objectMaxObjects, setObjectMaxObjects] = useState(50);
  const [apiFilename, setApiFilename] = useState("api-payload.json");
  const [apiContent, setApiContent] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [uploadResponse, setUploadResponse] =
    useState<DocumentBatchUploadResponse | null>(null);

  useEffect(() => {
    const nextDraft = loadDraft();
    setDraft(nextDraft);
    if (nextDraft.datasetId) {
      setDatasetIngestContextById({
        [nextDraft.datasetId]: {
          tags: nextDraft.tags,
          collection: nextDraft.collection || DEFAULT_COLLECTION,
        },
      });
    }
  }, []);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  const datasetsQuery = useQuery({
    queryKey: ["knowledge-ingestion-operation-datasets"],
    queryFn: () => datasetApi.listAll(),
    staleTime: 30_000,
  });

  const datasets = useMemo(
    () => datasetsQuery.data ?? [],
    [datasetsQuery.data],
  );

  useEffect(() => {
    const routeDatasetExists =
      routeDatasetId &&
      datasets.some((dataset) => dataset.id === routeDatasetId);
    const fallbackDatasetId = datasets[0]?.id;
    setDraft((current) => {
      if (routeDatasetExists && current.datasetId !== routeDatasetId)
        return { ...current, datasetId: routeDatasetId };
      if (current.datasetId || !fallbackDatasetId) return current;
      return { ...current, datasetId: fallbackDatasetId };
    });
  }, [datasets, routeDatasetId]);

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === draft.datasetId) ?? null,
    [datasets, draft.datasetId],
  );
  const activeFileBucketKey = draft.datasetId || NO_DATASET_FILE_BUCKET;
  const files = filesByDatasetId[activeFileBucketKey] ?? EMPTY_FILES;

  useEffect(() => {
    if (previousDatasetIdRef.current === null) {
      previousDatasetIdRef.current = draft.datasetId;
      return;
    }
    if (previousDatasetIdRef.current === draft.datasetId) return;
    previousDatasetIdRef.current = draft.datasetId;
    setUploadResponse(null);
    setStatus("idle");
  }, [draft.datasetId]);

  useEffect(() => {
    if (!draft.datasetId) return;
    const context = datasetIngestContextById[draft.datasetId];
    const nextTags = context?.tags ?? DEFAULT_DRAFT.tags;
    const nextCollection = context?.collection ?? DEFAULT_COLLECTION;
    setDraft((current) => {
      if (current.datasetId !== draft.datasetId) return current;
      if (current.tags === nextTags && current.collection === nextCollection)
        return current;
      return { ...current, tags: nextTags, collection: nextCollection };
    });
  }, [datasetIngestContextById, draft.datasetId]);

  const ingestionStatsQuery = useQuery({
    queryKey: ["knowledge-ingestion-operation-stats", draft.datasetId],
    queryFn: () => datasetApi.getIngestionStats(draft.datasetId),
    enabled: Boolean(draft.datasetId),
    staleTime: 10_000,
  });

  const ingestionStats = ingestionStatsQuery.data ?? null;

  const documentsQuery = useQuery({
    queryKey: ["knowledge-ingestion-operation-documents", draft.datasetId],
    queryFn: () =>
      documentApi.list({
        dataset_id: draft.datasetId,
        limit: 50,
        order_by: "created_at",
        order_dir: "desc",
      }),
    enabled: Boolean(draft.datasetId),
    staleTime: 10_000,
  });

  const documents = useMemo(
    () => documentsQuery.data?.items ?? [],
    [documentsQuery.data?.items],
  );

  const foldersQuery = useQuery({
    queryKey: ["knowledge-ingestion-operation-folders", draft.datasetId],
    queryFn: () =>
      documentApi.folders({ dataset_id: draft.datasetId, max_depth: 20 }),
    enabled: Boolean(draft.datasetId),
    staleTime: 10_000,
  });

  const tagOptions = useMemo(
    () => collectTagOptions(documents, draft.tags),
    [documents, draft.tags],
  );
  const collectionOptions = useMemo(
    () =>
      collectCollectionOptions(
        foldersQuery.data?.root,
        files,
        draft.collection,
      ),
    [draft.collection, files, foldersQuery.data?.root],
  );

  const settingsQuery = useQuery({
    queryKey: ["knowledge-ingestion-operation-settings"],
    queryFn: () => settingsApi.get(),
    staleTime: 30_000,
  });

  const urlIngestEnabled = Boolean(settingsQuery.data?.url_ingest?.enabled);

  const selectedTotalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  const parsedUrls = useMemo(() => parseUrlList(urlList), [urlList]);
  const parsedObjectExtensions = useMemo(
    () => parseExtensions(objectExtensions),
    [objectExtensions],
  );
  const pendingSourceCount = useMemo(() => {
    if (source === "url") return parsedUrls.length;
    if (source === "object") return objectMaxObjects;
    if (source === "api") return apiContent.trim() ? 1 : 0;
    return files.length;
  }, [apiContent, files.length, objectMaxObjects, parsedUrls.length, source]);

  const connectorSourceBlocked =
    (source === "url" || source === "object") && !urlIngestEnabled;
  const canStartIngest =
    Boolean(draft.datasetId) &&
    status !== "uploading" &&
    pendingSourceCount > 0 &&
    !connectorSourceBlocked;

  const totalDocuments = ingestionStats?.total_documents ?? documents.length;
  const totalChunks =
    ingestionStats?.total_chunks ??
    documents.reduce((sum, item) => sum + Number(item.chunk_count || 0), 0);
  const datasetTotalBytes =
    ingestionStats?.total_size ??
    documents.reduce((sum, item) => sum + Number(item.file_size || 0), 0);

  const fileRows = useMemo(
    () =>
      files.map((file) => {
        const Icon = getFileIcon(file);
        return { file, Icon, key: fileKey(file) };
      }),
    [files],
  );
  const activeSource =
    SOURCE_OPTIONS.find((item) => item.value === source) ?? SOURCE_OPTIONS[0];

  const fileStatusByName = useMemo(() => {
    const next: Record<string, FileUploadState> = {};
    for (const item of uploadResponse?.successful ?? [])
      next[item.filename] = "submitted";
    for (const item of uploadResponse?.failed ?? [])
      next[item.filename] = "failed";
    return next;
  }, [uploadResponse]);

  const updateDraft = useCallback(
    <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
      if ((key === "tags" || key === "collection") && draft.datasetId) {
        setDatasetIngestContextById((current) => {
          const previous = current[draft.datasetId] ?? {
            tags: DEFAULT_DRAFT.tags,
            collection: DEFAULT_COLLECTION,
          };
          return {
            ...current,
            [draft.datasetId]: {
              ...previous,
              [key]: String(value || ""),
            },
          };
        });
      }
      setDraft((current) => ({ ...current, [key]: value }));
    },
    [draft.datasetId],
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      const supported = incoming.filter((file) => {
        const lower = file.name.toLowerCase();
        return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
      });
      const rejected = incoming.length - supported.length;
      setFilesByDatasetId((current) => {
        const activeFiles = current[activeFileBucketKey] ?? [];
        const byKey = new Map(activeFiles.map((file) => [fileKey(file), file]));
        for (const file of supported) byKey.set(fileKey(file), file);
        return {
          ...current,
          [activeFileBucketKey]: Array.from(byKey.values()),
        };
      });
      if (rejected > 0) {
        toast.warning(`${rejected} 个文件格式未在允许列表中，已跳过`);
      }
    },
    [activeFileBucketKey],
  );

  const clearFiles = useCallback(() => {
    setFilesByDatasetId((current) => ({
      ...current,
      [activeFileBucketKey]: [],
    }));
    setUploadResponse(null);
    setStatus("idle");
  }, [activeFileBucketKey]);

  const removeFile = useCallback(
    (key: string) => {
      setFilesByDatasetId((current) => ({
        ...current,
        [activeFileBucketKey]: (current[activeFileBucketKey] ?? []).filter(
          (file) => fileKey(file) !== key,
        ),
      }));
    },
    [activeFileBucketKey],
  );

  const submitConnectorRun = useCallback(async () => {
    if (!draft.datasetId) {
      toast.error("请先选择目标数据集");
      return;
    }
    if (!urlIngestEnabled) {
      toast.error("URL 导入未启用：请先在系统设置中开启 URL_INGEST_ENABLED");
      return;
    }
    setStatus("uploading");
    setUploadResponse(null);
    try {
      const sharedConfig = {
        parser_backend: draft.parserBackend,
        chunk_strategy: normalizeChunkStrategy(draft.chunkStrategy),
        pipeline: buildPipeline(draft),
      };
      const run =
        source === "url"
          ? await connectorApi.createRun({
              connector_id: "url_batch",
              dataset_id: draft.datasetId,
              config: {
                urls: parsedUrls,
                filename: urlFilename.trim() || undefined,
                ...sharedConfig,
              },
            })
          : await connectorApi.createRun({
              connector_id: "minio_bucket",
              dataset_id: draft.datasetId,
              config: {
                bucket: objectBucket.trim() || undefined,
                prefix: objectPrefix.trim() || undefined,
                include_extensions: parsedObjectExtensions,
                max_objects: objectMaxObjects,
                ...sharedConfig,
              },
            });
      setStatus(
        run.status === "failed"
          ? "failed"
          : run.status === "completed"
            ? "completed"
            : "uploading",
      );
      await Promise.all([
        foldersQuery.refetch(),
        ingestionStatsQuery.refetch(),
      ]);
      toast.success(`连接器任务已创建：${String(run.id).slice(0, 8)}`);
      if (
        run.status !== "failed" &&
        shouldOpenExecutionMonitor(draft, "ingest")
      ) {
        router.push("/knowledge/ingestion?mode=execution-monitor");
      }
    } catch (error) {
      setStatus("failed");
      toast.error(formatApiError(error, "连接器任务创建失败"));
    }
  }, [
    draft,
    foldersQuery,
    ingestionStatsQuery,
    objectBucket,
    objectMaxObjects,
    objectPrefix,
    parsedObjectExtensions,
    parsedUrls,
    router,
    source,
    urlIngestEnabled,
    urlFilename,
  ]);

  const handleSyncDatasets = useCallback(async () => {
    await datasetsQuery.refetch();
    if (draft.datasetId) {
      await Promise.all([
        documentsQuery.refetch(),
        foldersQuery.refetch(),
        ingestionStatsQuery.refetch(),
      ]);
    }
    toast.success("数据集状态已同步");
  }, [
    datasetsQuery,
    documentsQuery,
    draft.datasetId,
    foldersQuery,
    ingestionStatsQuery,
  ]);

  const uploadFiles = useCallback(
    async (mode: "upload_only" | "ingest") => {
      if (!draft.datasetId) {
        toast.error("请先选择目标数据集");
        return;
      }
      if (mode === "upload_only" && (source === "url" || source === "object")) {
        toast.error(
          "URL/对象存储不能使用仅登记模式，请先下载为本地文件或选择解析入库",
        );
        return;
      }
      if (mode === "upload_only" && source === "api") {
        toast.error("API 导入没有原始文件可登记，请选择“解析入库”");
        return;
      }
      if (source === "url" || source === "object") {
        if (source === "url" && !parsedUrls.length) {
          toast.error("请先填写有效 URL");
          return;
        }
        await submitConnectorRun();
        return;
      }
      if (source === "api" && !apiContent.trim()) {
        toast.error("请先填写 API 导入内容");
        return;
      }
      if (source !== "api" && !files.length) {
        toast.error("请先选择待入库文件");
        return;
      }
      const uploadTargets = files;
      setStatus("uploading");
      setUploadResponse(null);
      try {
        if (source === "api") {
          const filename = apiFilename.trim() || "api-payload.json";
          const document = await documentApi.createFromChunks({
            dataset_id: draft.datasetId,
            filename,
            file_type: apiPayloadFileType(filename),
            file_size: new TextEncoder().encode(apiContent).length,
            pipeline: buildPipeline(draft),
            metadata: {
              source: "api",
              collection: draft.collection,
              tags: draft.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
              ingest_mode: draft.ingestMode,
            },
            chunks: [
              {
                content: apiContent,
                page_number: 1,
                start_char: 0,
                end_char: apiContent.length,
                metadata: {
                  source: "api",
                  collection: draft.collection,
                },
              },
            ],
          });
          setUploadResponse({
            total: 1,
            successful_count: 1,
            failed_count: 0,
            successful: [
              {
                document_id: document.id,
                filename,
                status: String(document.status || "completed"),
              },
            ],
            failed: [],
          });
          setStatus("completed");
          await Promise.all([
            documentsQuery.refetch(),
            foldersQuery.refetch(),
            ingestionStatsQuery.refetch(),
          ]);
          toast.success(`API 导入已写入：${filename}`);
          return;
        }
        const uploadOptions = {
          dataset_id: draft.datasetId,
          parser_backend: draft.parserBackend,
          chunk_strategy: normalizeChunkStrategy(draft.chunkStrategy),
          pipeline: buildPipeline(draft),
          upload_only: mode === "upload_only",
          max_concurrent: 4,
          user_metadata_map: Object.fromEntries(
            uploadTargets.map((file) => [
              fileUploadName(file),
              {
                tags: draft.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                collection: draft.collection,
                ingest_mode: draft.ingestMode,
                source,
              },
            ]),
          ),
        };
        const response = await documentApi.uploadBatch(files, uploadOptions);
        setUploadResponse(response);
        setStatus(response.failed_count > 0 ? "failed" : "completed");
        await Promise.all([
          documentsQuery.refetch(),
          foldersQuery.refetch(),
          ingestionStatsQuery.refetch(),
        ]);
        toast.success(
          mode === "upload_only"
            ? `已登记到知识库：成功 ${response.successful_count} / 失败 ${response.failed_count}`
            : `入库任务已提交：成功 ${response.successful_count} / 失败 ${response.failed_count}`,
        );
        if (
          response.successful_count > 0 &&
          shouldOpenExecutionMonitor(draft, mode)
        ) {
          router.push("/knowledge/ingestion?mode=execution-monitor");
        }
      } catch (error) {
        setStatus("failed");
        toast.error(formatApiError(error, "入库任务提交失败"));
      }
    },
    [
      apiContent,
      apiFilename,
      documentsQuery,
      draft,
      files,
      foldersQuery,
      ingestionStatsQuery,
      parsedUrls.length,
      router,
      source,
      submitConnectorRun,
    ],
  );

  const sourceConfigurationProps = {
    folderInputRef,
    onFiles: addFiles,
    urlList,
    setUrlList,
    urlFilename,
    setUrlFilename,
    parsedUrls,
    objectBucket,
    setObjectBucket,
    objectPrefix,
    setObjectPrefix,
    objectExtensions,
    setObjectExtensions,
    objectMaxObjects,
    setObjectMaxObjects,
    parsedObjectExtensions,
    urlIngestEnabled,
    apiFilename,
    setApiFilename,
    apiContent,
    setApiContent,
  };

  const activeStageCount =
    draft.executionMode === "upload_only"
      ? 1
      : draft.executionMode === "parse_only"
        ? 2
        : OPERATION_STAGES.length;
  const ActiveSourceIcon = activeSource.icon;
  const uploadOnlySourceBlocked =
    source === "url" || source === "object" || source === "api";
  const sourceExecutionBlocked =
    draft.executionMode === "upload_only" && uploadOnlySourceBlocked;
  const operationReady = canStartIngest && !sourceExecutionBlocked;
  const actionLabel =
    draft.executionMode === "upload_only"
      ? "登记文件"
      : draft.executionMode === "full_index"
        ? "解析并建索引"
        : "登记并解析";
  const emptySourceMessage =
    source === "local" || source === "folder"
      ? "请添加待入库文件"
      : source === "url"
        ? "请填写至少一个有效 URL"
        : source === "object"
          ? "请配置对象存储范围"
          : "请填写 API 导入内容";
  const preflightMessage = !draft.datasetId
    ? "请选择目标数据集"
    : connectorSourceBlocked
      ? "当前环境未启用 URL/对象存储导入"
      : sourceExecutionBlocked
        ? "当前来源不支持“仅登记”"
        : pendingSourceCount === 0
          ? emptySourceMessage
          : "可以提交";
  const preflightDisplay =
    status === "uploading" ? "正在提交，请稍候…" : preflightMessage;
  const selectedExecutionOption =
    EXECUTION_MODE_OPTIONS.find(
      (option) => option.value === draft.executionMode,
    ) ?? EXECUTION_MODE_OPTIONS[0];
  const submissionSummary = uploadResponse
    ? `上次提交：成功 ${uploadResponse.successful_count} · 失败 ${uploadResponse.failed_count}`
    : "";
  const stepFlowSteps: StepFlowStep[] = OPERATION_STAGES.map((stage, index) => {
    const enabled = index < activeStageCount;
    return {
      id: stage.id,
      label: <span title={stage.description}>{stage.label}</span>,
      status: enabled ? "已启用" : "跳过",
      state: enabled ? "active" : "skipped",
      disabled: stage.id === "register" && uploadOnlySourceBlocked,
    };
  });

  const handleStepClick = useCallback(
    (stepId: string) => {
      const mode = STAGE_EXECUTION_MODE[stepId as OperationStageId];
      if (isIngestExecutionMode(mode)) updateDraft("executionMode", mode);
    },
    [updateDraft],
  );

  return (
    <div
      data-ingestion-operation-root="true"
      className="flex h-full min-h-0 flex-col"
    >
      <PageHeader
        className="px-6"
        title="新建入库任务"
        description="选择目标与来源，确认执行路径后提交。"
      >
        <Button
          variant="ghost"
          size="icon"
          title="同步数据集状态"
          aria-label="同步数据集状态"
          onClick={() => detachPromise(handleSyncDatasets())}
        >
          <RefreshCw className="size-4" />
        </Button>
      </PageHeader>

      <div className="border-b border-border px-6">
        <IngestionViewSwitch compact tone="info" />
      </div>

      <PageBody className="pt-0 pb-0">
        <div
          data-ingestion-operation-workspace="true"
          className={PAGE_COLUMN_CLASS}
        >
          <section
            data-ingestion-target-section="true"
            className={SECTION_CLASS}
          >
            <div className={SECTION_HEADER_CLASS}>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-micro text-muted-foreground"
                  aria-hidden="true"
                >
                  ①
                </span>
                <h2 className="section-heading">目标数据集</h2>
              </div>
              <Button
                variant="ghost"
                className="px-2 text-caption"
                onClick={() => router.push("/datasets")}
              >
                <Plus className="size-3.5" />
                新建
              </Button>
            </div>
            <p className="mt-1 section-description">本次入库写入的知识库。</p>
            <Select
              value={draft.datasetId}
              onValueChange={(value) => updateDraft("datasetId", value)}
            >
              <SelectTrigger id="ingestion-dataset" className="mt-3">
                <span className="min-w-0 truncate text-compact font-medium">
                  {selectedDataset?.name ??
                    (datasetsQuery.isLoading
                      ? "正在加载数据集"
                      : "选择目标数据集")}
                </span>
              </SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem
                    key={dataset.id}
                    value={dataset.id}
                    textValue={dataset.name}
                    className="min-h-11"
                  >
                    <DatasetOptionBody dataset={dataset} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
              <span>
                <span className="font-mono tabular-nums text-foreground">
                  {totalDocuments.toLocaleString()}
                </span>{" "}
                文档
              </span>
              <span>
                <span className="font-mono tabular-nums text-foreground">
                  {totalChunks.toLocaleString()}
                </span>{" "}
                分块
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {formatFileSize(datasetTotalBytes)}
              </span>
            </div>
          </section>

          <section data-ingestion-file-stage="true" className={SECTION_CLASS}>
            <div className={SECTION_HEADER_CLASS}>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-micro text-muted-foreground"
                  aria-hidden="true"
                >
                  ②
                </span>
                <h2 className="section-heading">文件来源</h2>
              </div>
              <span className="font-mono text-micro text-muted-foreground">
                5 种来源
              </span>
            </div>
            <p className="mt-1 section-description">
              切换来源时，各来源参数会分别保留。
            </p>
            <Select
              value={source}
              onValueChange={(value) =>
                setSource(value as UploadSource)
              }
            >
              <SelectTrigger id="ingestion-source" className="mt-3">
                <span className="flex min-w-0 items-center gap-2">
                  <ActiveSourceIcon className="size-4 shrink-0 text-foreground" />
                  <span className="truncate text-compact font-medium">
                    {activeSource.label}
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      textValue={item.label}
                      className="min-h-11"
                    >
                      <span className="flex items-start gap-2">
                        <Icon className="mt-0.5 size-4 text-foreground" />
                        <span>
                          <span className="block font-medium">
                            {item.label}
                          </span>
                          <span className="block text-micro text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-micro text-muted-foreground">
              {activeSource.description}
            </p>

            <div className="mt-4">
              {source === "folder" ? (
                <SourceConfiguration
                  source="folder"
                  {...sourceConfigurationProps}
                />
              ) : null}
              {source === "url" ? (
                <SourceConfiguration
                  source="url"
                  {...sourceConfigurationProps}
                />
              ) : null}
              {source === "object" ? (
                <SourceConfiguration
                  source="object"
                  {...sourceConfigurationProps}
                />
              ) : null}
              {source === "api" ? (
                <SourceConfiguration
                  source="api"
                  {...sourceConfigurationProps}
                />
              ) : null}
            </div>

            {source === "local" || source === "folder" ? (
              <IngestionFileQueue
                rows={fileRows}
                totalBytes={selectedTotalBytes}
                dragging={dragging}
                submitting={status === "uploading"}
                fileStatusByName={fileStatusByName}
                onDragState={setDragging}
                onFiles={addFiles}
                onChoose={() =>
                  source === "folder"
                    ? folderInputRef.current?.click()
                    : inputRef.current?.click()
                }
                onClear={clearFiles}
                onRemove={removeFile}
              />
            ) : null}

            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </section>

          <section data-ingestion-pipeline="true" className={SECTION_CLASS}>
            <div className={SECTION_HEADER_CLASS}>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-micro text-muted-foreground"
                  aria-hidden="true"
                >
                  ③
                </span>
                <h2 className="section-heading">执行路径</h2>
              </div>
              <span className="font-mono text-micro text-muted-foreground">
                {activeStageCount} 个阶段
              </span>
            </div>
            <p className="mt-1 section-description">
              选择执行终点；预设与节点保持同步。
            </p>

            <fieldset className="mt-4">
              <legend className="sr-only">执行终点</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {EXECUTION_MODE_OPTIONS.map((option) => {
                  const selected = draft.executionMode === option.value;
                  const blocked =
                    option.value === "upload_only" && uploadOnlySourceBlocked;
                  return (
                    <label
                      key={option.value}
                      data-active={selected ? "true" : "false"}
                      className={cn(
                        "step-flow__preset min-h-11 cursor-pointer select-none rounded-sm px-1 focus-within:ring-2 focus-within:ring-ring/40",
                        blocked && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="ingestion-execution-mode"
                        value={option.value}
                        checked={selected}
                        disabled={blocked}
                        onChange={() =>
                          updateDraft("executionMode", option.value)
                        }
                        className="sr-only"
                      />
                      <span
                        className="step-flow__preset-dot"
                        aria-hidden="true"
                      />
                      <span>{option.title}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="mt-2 text-caption text-muted-foreground">
              {selectedExecutionOption.description}
            </p>

            <StepFlow
              steps={stepFlowSteps}
              onStepClick={handleStepClick}
              className="mt-4 [&_.step-flow__step]:min-h-11 [&_.step-flow__step:focus-visible]:outline-none [&_.step-flow__step:focus-visible]:ring-2 [&_.step-flow__step:focus-visible]:ring-ring/40"
            />
            <p className="mt-2 text-micro text-muted-foreground">
              治理随完整入库执行。
            </p>

            <AdvancedIngestSettings
              draft={draft}
              updateDraft={updateDraft}
              tagOptions={tagOptions}
              collectionOptions={collectionOptions}
            />
          </section>

          <footer
            data-ingestion-action-bar="true"
            className="sticky bottom-0 z-10 mt-auto border-t border-border bg-background"
          >
            <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div data-ingestion-preflight="true" className="min-w-0">
                <div className="flex items-center gap-2 text-caption">
                  {status === "uploading" ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-foreground" />
                  ) : operationReady ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : (
                    <CircleAlert className="size-4 shrink-0 text-warning" />
                  )}
                  <span
                    className={cn(
                      "font-medium",
                      status === "uploading"
                        ? "text-foreground"
                        : operationReady
                          ? "text-success"
                          : "text-warning",
                    )}
                  >
                    {preflightDisplay}
                  </span>
                </div>
                {submissionSummary ? (
                  <p className="mt-1 text-micro leading-4 text-muted-foreground">
                    {submissionSummary}
                  </p>
                ) : null}
              </div>
              <Button
                className="w-full sm:min-w-32 sm:w-auto"
                onClick={() =>
                  detachPromise(
                    uploadFiles(
                      draft.executionMode === "upload_only"
                        ? "upload_only"
                        : "ingest",
                    ),
                  )
                }
                disabled={!operationReady}
              >
                {status === "uploading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {status === "uploading"
                  ? "正在提交"
                  : status === "completed"
                    ? "再次提交"
                    : actionLabel}
              </Button>
            </div>
          </footer>
        </div>
      </PageBody>
    </div>
  );
}

function SourceConfiguration({
  source,
  folderInputRef,
  onFiles,
  urlList,
  setUrlList,
  urlFilename,
  setUrlFilename,
  parsedUrls,
  objectBucket,
  setObjectBucket,
  objectPrefix,
  setObjectPrefix,
  objectExtensions,
  setObjectExtensions,
  objectMaxObjects,
  setObjectMaxObjects,
  parsedObjectExtensions,
  urlIngestEnabled,
  apiFilename,
  setApiFilename,
  apiContent,
  setApiContent,
}: Readonly<{
  source: Exclude<UploadSource, "local">;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: File[]) => void;
  urlList: string;
  setUrlList: (value: string) => void;
  urlFilename: string;
  setUrlFilename: (value: string) => void;
  parsedUrls: string[];
  objectBucket: string;
  setObjectBucket: (value: string) => void;
  objectPrefix: string;
  setObjectPrefix: (value: string) => void;
  objectExtensions: string;
  setObjectExtensions: (value: string) => void;
  objectMaxObjects: number;
  setObjectMaxObjects: (value: number) => void;
  parsedObjectExtensions: string[];
  urlIngestEnabled: boolean;
  apiFilename: string;
  setApiFilename: (value: string) => void;
  apiContent: string;
  setApiContent: (value: string) => void;
}>) {
  if (source === "folder") {
    return (
      <div className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background text-foreground">
            <Folder className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-compact font-semibold text-foreground">
              选择本地文件夹
            </p>
            <p className="text-micro leading-4 text-muted-foreground">
              浏览器会保留相对路径，后端按文件夹内文件批量上传到当前数据集。
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => folderInputRef.current?.click()}
        >
          <Folder className="size-4" />
          选择文件夹
        </Button>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  if (source === "url") {
    return (
      <div className="grid gap-4">
        <Field
          label="URL 列表"
          htmlFor="ingestion-url-list"
          hint={
            urlIngestEnabled
              ? `已识别 ${parsedUrls.length} 个有效 http(s) 地址。`
              : "URL 导入未启用：请先在系统设置开启 URL_INGEST_ENABLED。"
          }
        >
          <Textarea
            id="ingestion-url-list"
            value={urlList}
            onChange={(event) => setUrlList(event.target.value)}
            placeholder={
              "https://example.com/manual.pdf\nhttps://example.com/guide.md"
            }
          />
        </Field>
        <Field label="统一文件名（可选）" htmlFor="ingestion-url-filename">
          <Input
            id="ingestion-url-filename"
            value={urlFilename}
            onChange={(event) => setUrlFilename(event.target.value)}
            placeholder="remote-documents.md"
          />
        </Field>
      </div>
    );
  }

  if (source === "object") {
    return (
      <div className="grid gap-4">
        {urlIngestEnabled ? null : (
          <p className="border border-warning/30 bg-warning/5 px-3 py-2 text-caption leading-5 text-warning">
            URL 导入未启用：对象存储需要后端通过 presigned URL
            拉取文件，请先开启 URL_INGEST_ENABLED。
          </p>
        )}
        <Field label="Bucket（可选）" htmlFor="ingestion-object-bucket">
          <Input
            id="ingestion-object-bucket"
            value={objectBucket}
            onChange={(event) => setObjectBucket(event.target.value)}
            placeholder="默认使用后端 MINIO_BUCKET_NAME"
          />
        </Field>
        <Field label="对象前缀" htmlFor="ingestion-object-prefix">
          <Input
            id="ingestion-object-prefix"
            value={objectPrefix}
            onChange={(event) => setObjectPrefix(event.target.value)}
            placeholder="manuals/2026/"
          />
        </Field>
        <Field
          label="扩展名"
          htmlFor="ingestion-object-extensions"
          hint={`实际提交：${parsedObjectExtensions.join(", ")}`}
        >
          <Input
            id="ingestion-object-extensions"
            value={objectExtensions}
            onChange={(event) => setObjectExtensions(event.target.value)}
            placeholder=".pdf, .md, .txt"
          />
        </Field>
        <Field label="最大对象数" htmlFor="ingestion-object-max">
          <Input
            id="ingestion-object-max"
            min={1}
            max={200}
            type="number"
            value={objectMaxObjects}
            onChange={(event) =>
              setObjectMaxObjects(
                Math.min(200, Math.max(1, Number(event.target.value) || 1)),
              )
            }
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Field
        label="生成文件名"
        htmlFor="ingestion-api-filename"
        hint="按单段内容写入当前数据集。"
      >
        <Input
          id="ingestion-api-filename"
          value={apiFilename}
          onChange={(event) => setApiFilename(event.target.value)}
          placeholder="api-payload.json"
        />
      </Field>
      <Field label="API Payload" htmlFor="ingestion-api-content">
        <Textarea
          id="ingestion-api-content"
          className="font-mono"
          value={apiContent}
          onChange={(event) => setApiContent(event.target.value)}
          placeholder={'{"title":"产品说明","content":"这里粘贴接口推送内容"}'}
        />
      </Field>
    </div>
  );
}

function IngestionFileQueue({
  rows,
  totalBytes,
  dragging,
  submitting,
  fileStatusByName,
  onDragState,
  onFiles,
  onChoose,
  onClear,
  onRemove,
}: Readonly<{
  rows: Array<{ file: File; Icon: LucideIcon; key: string }>;
  totalBytes: number;
  dragging: boolean;
  submitting: boolean;
  fileStatusByName: Record<string, FileUploadState>;
  onDragState: (dragging: boolean) => void;
  onFiles: (files: File[]) => void;
  onChoose: () => void;
  onClear: () => void;
  onRemove: (key: string) => void;
}>) {
  const hasRows = rows.length > 0;

  const fileStatus = (file: File) => {
    const uploadState = fileStatusByName[fileUploadName(file)];
    if (uploadState === "submitted")
      return { label: "已提交", className: "text-success" };
    if (uploadState === "failed")
      return { label: "失败", className: "text-destructive" };
    if (submitting) return { label: "提交中", className: "text-foreground" };
    return { label: "待提交", className: "text-muted-foreground" };
  };

  return (
    <div
      data-ingestion-file-staging-workspace="true"
      data-selected-files-table="stable"
      className={cn("mt-4 border-t border-border", dragging && "bg-raised")}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragState(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragState(true);
      }}
      onDragLeave={() => onDragState(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDragState(false);
        onFiles(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2 text-compact font-semibold">
          <span>本次任务文件</span>
          <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-micro tabular-nums text-muted-foreground">
            {rows.length}
          </span>
        </div>
        {hasRows ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="px-2 text-caption"
              onClick={onChoose}
            >
              <Plus className="size-3.5" />
              添加
            </Button>
            <Button
              variant="ghost"
              className="px-2 text-caption text-muted-foreground"
              onClick={onClear}
            >
              <Trash2 className="size-3.5" />
              清空
            </Button>
          </div>
        ) : (
          <span className="text-micro text-muted-foreground">等待文件</span>
        )}
      </div>

      {hasRows ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-caption">
              <colgroup>
                <col className="sm:w-[58%]" />
                <col className="w-16 sm:w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-11 sm:w-[10%]" />
              </colgroup>
              <thead className="text-micro text-muted-foreground">
                <tr>
                  <th className="py-2 pr-2 font-medium">文件</th>
                  <th className="px-2 py-2 font-medium">大小</th>
                  <th className="px-2 py-2 font-medium">状态</th>
                  <th className="py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ file, Icon, key }) => {
                  const uploadName = fileUploadName(file);
                  const statusView = fileStatus(file);
                  return (
                    <tr key={key} className="h-11 border-t border-border">
                      <td className="min-w-0 py-1.5 pr-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span
                              className="block truncate text-compact text-foreground"
                              title={uploadName}
                            >
                              {uploadName}
                            </span>
                            <span className="block text-micro text-muted-foreground">
                              {formatFileType(file)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-1 py-1.5 font-mono text-micro tabular-nums text-muted-foreground sm:px-2">
                        {formatFileSize(file.size)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1.5 text-micro",
                          statusView.className,
                        )}
                      >
                        {statusView.label}
                      </td>
                      <td className="py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`移除文件 ${uploadName}`}
                          title={`移除文件 ${uploadName}`}
                          onClick={() => onRemove(key)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border py-2 text-micro text-muted-foreground">
            合计 {formatFileSize(totalBytes)}
          </div>
        </>
      ) : (
        <button
          type="button"
          data-ingestion-empty-file-drop="true"
          onClick={onChoose}
          className={cn(
            "flex min-h-40 w-full flex-col items-center justify-center border-t border-dashed border-border px-6 py-6 text-center transition-colors hover:bg-muted/40",
            dragging && "bg-raised",
          )}
        >
          <UploadCloud className="size-6 text-foreground" />
          <span className="mt-2 text-body font-semibold text-foreground">
            添加文件到本次任务
          </span>
          <span className="mt-1 text-caption text-muted-foreground">
            将文件拖到这里或点击选择 · 单文件 ≤ 2GB
          </span>
          <span className="mt-2 text-micro text-muted-foreground">
            支持 PDF、Word、Markdown、表格、文本与压缩包
          </span>
        </button>
      )}
    </div>
  );
}

function AdvancedIngestSettings({
  draft,
  updateDraft,
  tagOptions,
  collectionOptions,
}: Readonly<{
  draft: DraftState;
  updateDraft: <K extends keyof DraftState>(
    key: K,
    value: DraftState[K],
  ) => void;
  tagOptions: string[];
  collectionOptions: string[];
}>) {
  const tagListId = "knowledge-ingestion-tag-options";
  const collectionListId = "knowledge-ingestion-collection-options";
  const parserTitle = getSelectOptionTitle(PARSER_OPTIONS, draft.parserBackend);
  const dedupTitle = getSelectOptionTitle(DEDUP_OPTIONS, draft.dedupStrategy);

  return (
    <details
      data-ingestion-advanced-settings="true"
      className="group mt-4 border-t border-border"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-compact font-semibold">高级设置</span>
          <span className="truncate text-micro font-normal text-muted-foreground">
            切块 {draft.chunkSize} · 重叠 {draft.chunkOverlap} · 解析器{" "}
            {parserTitle} · 去重 {dedupTitle}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="grid gap-4 border-t border-border py-4">
        <Field label="入库模式" htmlFor="ingestion-ingest-mode">
          <Select
            value={draft.ingestMode}
            onValueChange={(value) =>
              updateDraft("ingestMode", value as IngestMode)
            }
          >
            <SelectTrigger id="ingestion-ingest-mode">
              <span className="truncate text-compact font-medium">
                {getSelectOptionTitle(INGEST_MODE_OPTIONS, draft.ingestMode)}
              </span>
            </SelectTrigger>
            <SelectContent>
              {INGEST_MODE_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  textValue={option.title}
                  className="min-h-11"
                >
                  <SelectOptionBody {...option} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="标签" htmlFor="ingestion-tags">
          <Input
            id="ingestion-tags"
            list={tagListId}
            value={draft.tags}
            onChange={(event) => updateDraft("tags", event.target.value)}
            placeholder="选择或输入标签"
          />
          <datalist id={tagListId}>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </Field>

        <Field label="目标目录" htmlFor="ingestion-collection">
          <Input
            id="ingestion-collection"
            list={collectionListId}
            value={draft.collection}
            onChange={(event) => updateDraft("collection", event.target.value)}
            placeholder="default"
          />
          <datalist id={collectionListId}>
            {collectionOptions.map((collection) => (
              <option key={collection} value={collection} />
            ))}
          </datalist>
        </Field>

        <Field label="重复处理" htmlFor="ingestion-dedup">
          <Select
            value={draft.dedupStrategy}
            onValueChange={(value) => updateDraft("dedupStrategy", value)}
          >
            <SelectTrigger id="ingestion-dedup">
              <span className="truncate text-compact font-medium">
                {getSelectOptionTitle(DEDUP_OPTIONS, draft.dedupStrategy)}
              </span>
            </SelectTrigger>
            <SelectContent>
              {DEDUP_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  textValue={option.title}
                  className="min-h-11"
                >
                  <SelectOptionBody {...option} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="解析器"
          htmlFor="ingestion-parser"
          hint="本次入库使用的解析器。"
        >
          <Select
            value={draft.parserBackend}
            onValueChange={(value) =>
              updateDraft("parserBackend", value as ParserBackend)
            }
          >
            <SelectTrigger id="ingestion-parser">
              <span className="truncate text-compact font-medium">
                {parserTitle}
              </span>
            </SelectTrigger>
            <SelectContent>
              {PARSER_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  textValue={option.title}
                  className="min-h-11"
                >
                  <SelectOptionBody {...option} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="切块方式"
          htmlFor="ingestion-chunk-strategy"
          hint="本次入库使用的切块方式。"
        >
          <Select
            value={draft.chunkStrategy}
            onValueChange={(value) =>
              updateDraft("chunkStrategy", value as ChunkStrategy)
            }
          >
            <SelectTrigger id="ingestion-chunk-strategy">
              <span className="truncate text-compact font-medium">
                {getSelectOptionTitle(
                  CHUNK_STRATEGY_OPTIONS,
                  draft.chunkStrategy,
                )}
              </span>
            </SelectTrigger>
            <SelectContent>
              {CHUNK_STRATEGY_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  textValue={option.title}
                  className="min-h-11"
                >
                  <SelectOptionBody {...option} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="切块大小"
          htmlFor="ingestion-chunk-size"
          hint="单个切块的目标长度。"
        >
          <Input
            id="ingestion-chunk-size"
            type="number"
            min={1}
            step={1}
            value={draft.chunkSize}
            onChange={(event) =>
              updateDraft(
                "chunkSize",
                Math.max(1, Number(event.target.value) || 1),
              )
            }
          />
        </Field>

        <Field
          label="重叠字符"
          htmlFor="ingestion-chunk-overlap"
          hint="相邻切块的重叠字符数，可为 0。"
        >
          <Input
            id="ingestion-chunk-overlap"
            type="number"
            min={0}
            step={1}
            value={draft.chunkOverlap}
            onChange={(event) =>
              updateDraft(
                "chunkOverlap",
                Math.max(0, Number(event.target.value) || 0),
              )
            }
          />
        </Field>
      </div>
    </details>
  );
}
