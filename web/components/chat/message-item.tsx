/**
 * Shared chat message item (ChatArea + History).
 *
 * The default variant is the engineering reading layout used by the chat page:
 * a 44px speaker column, no message bubbles, and citations attached to the answer.
 * The `minimal` variant keeps the compact transcript used by the history page.
 */
"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Database,
  Loader2,
  Star,
  TestTube2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AuthImage } from "@/components/auth-image";
import { useRouter } from "@/i18n/navigation";
import {
  resolveMarkdownImageSrc,
  sanitizeMarkdownHref,
} from "@/components/markdown/markdown-safety";
import type {
  Citation,
  FeedbackCategory,
  Message,
  MessageFeedback,
} from "@/types";
import { getDocumentPreviewAnchorFromCitation } from "@/lib/document-preview-anchor";
import { cn, detachPromise } from "@/lib/utils";
import { globalEventBus } from "@/lib/event-bus";
import { toAbsoluteBackendUrl } from "@/lib/env";
import { prefetchDocumentView } from "@/lib/document-view-prefetch";
import {
  useDocumentView,
  type DocumentViewSourceContext,
} from "@/store/document-view";
import { resolveSafeCitationImageUrl } from "@/lib/citation-images";
import { EvidenceViewerDialog } from "@/components/evidence/evidence-viewer-dialog";
import {
  formatCitationRankScore,
  formatCitationScore,
  isUsableScore,
} from "@/components/chat/citation-score";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { documentApi, feedbackApi } from "@/lib/api";
import { formatApiError } from "@/lib/api-errors";
import { reportClientError } from "@/lib/client-logging";
import { toast } from "sonner";

const INLINE_CITATION_HREF_PREFIX = "mimirq-citation://";
const COLLAPSED_CITATION_COUNT = 3;

type InlineCitationHandlers = Readonly<{
  onClick: (href?: string) => void;
  onPrefetch: (href?: string) => void;
}>;

const InlineCitationHandlersContext = createContext<InlineCitationHandlers>({
  onClick: () => {},
  onPrefetch: () => {},
});

type ConfidenceMeta = Readonly<{
  label: string;
  summary: string;
  badgeClass: string;
}>;
type ClaimEvidenceReference = Record<string, unknown> & {
  document_id?: string;
  chunk_id?: string;
  start_char?: number;
  end_char?: number;
  score?: number;
  quote?: string;
};
type ClaimEvidenceItem = Record<string, unknown> & {
  claim?: string;
  evidence?: ClaimEvidenceReference[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function claimEvidenceReferences(value: unknown): ClaimEvidenceReference[] {
  return Array.isArray(value)
    ? value.filter((item): item is ClaimEvidenceReference => isRecord(item))
    : [];
}

function claimEvidenceItems(value: unknown): ClaimEvidenceItem[] | null {
  return Array.isArray(value)
    ? value.filter((item): item is ClaimEvidenceItem => isRecord(item))
    : null;
}

function claimEvidenceReferenceKey(ev: ClaimEvidenceReference): string {
  return String(ev.chunk_id || ev.document_id || "");
}

function getCitationRange(
  citation: Citation,
): { start: number; end: number } | undefined {
  let start: number | null = null;
  if (typeof citation.evidence_start_char === "number") {
    start = citation.evidence_start_char;
  } else if (typeof citation.start_char === "number") {
    start = citation.start_char;
  }

  let end: number | null = null;
  if (typeof citation.evidence_end_char === "number") {
    end = citation.evidence_end_char;
  } else if (typeof citation.end_char === "number") {
    end = citation.end_char;
  }

  return start != null && end != null && end > start
    ? { start, end }
    : undefined;
}

function parseInlineCitationHref(
  href?: string,
): { documentId?: string; chunkId?: string } | null {
  if (!href?.startsWith(INLINE_CITATION_HREF_PREFIX)) return null;

  try {
    const parsed = new URL(href);
    const documentId =
      (parsed.searchParams.get("document_id") || "").trim() || undefined;
    const chunkId =
      (parsed.searchParams.get("chunk_id") || "").trim() || undefined;
    if (!documentId && !chunkId) return null;
    return { documentId, chunkId };
  } catch {
    return null;
  }
}

function buildChatCitationSourceContext(
  messageId: string,
  documentId: string | null | undefined,
  chunkId?: string | null,
  citation?: Citation | null,
): DocumentViewSourceContext | null {
  const normalizedMessageId = String(messageId || "").trim();
  const normalizedDocumentId = String(documentId || "").trim();
  if (!normalizedMessageId || !normalizedDocumentId) return null;

  const normalizedChunkId = String(chunkId || "").trim();
  return {
    kind: "chat-citation",
    messageId: normalizedMessageId,
    documentId: normalizedDocumentId,
    chunkId: normalizedChunkId || null,
    documentName: String(citation?.document_name || "").trim() || null,
    chunkContent: String(citation?.chunk_content || "").trim() || null,
    chunkIndex:
      typeof citation?.chunk_index === "number" ? citation.chunk_index : null,
    pageNumber:
      typeof citation?.page_number === "number" ? citation.page_number : null,
  };
}

function getConfidenceMeta(
  confidenceScore: number | null,
): ConfidenceMeta | null {
  if (confidenceScore == null) return null;
  if (confidenceScore >= 0.75) {
    return {
      label: "高置信度",
      summary: "证据与回答整体一致",
      badgeClass: "border-success/20 bg-success/10 text-success",
    };
  }
  if (confidenceScore >= 0.5) {
    return {
      label: "部分支撑",
      summary: "存在有效证据，但仍建议交叉确认",
      badgeClass: "border-warning/20 bg-warning/10 text-warning",
    };
  }
  return {
    label: "证据不足",
    summary: "当前回答缺少足够支撑，建议继续追问",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
  };
}

function formatMetricValue(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return null;
}

function getCitationSecondaryScore(
  citation: Citation,
): { label: string; value: string } | null {
  if (isUsableScore(citation.rerank_score)) {
    return { label: "重排", value: formatCitationScore(citation.rerank_score) };
  }
  if (isUsableScore(citation.vector_score)) {
    return { label: "向量", value: formatCitationScore(citation.vector_score) };
  }
  if (isUsableScore(citation.bm25_score)) {
    return { label: "关键词", value: formatCitationScore(citation.bm25_score) };
  }
  if (isUsableScore(citation.retrieval_score)) {
    return {
      label: "召回",
      value: formatCitationScore(citation.retrieval_score),
    };
  }
  return null;
}

function buildCitationScoreTitle(citation: Citation): string {
  const parts = [
    `综合分 ${formatCitationScore(citation.relevance_score)}`,
    isUsableScore(citation.rerank_score)
      ? `重排 ${formatCitationScore(citation.rerank_score)}`
      : null,
    isUsableScore(citation.vector_score)
      ? `向量 ${formatCitationScore(citation.vector_score)}`
      : null,
    isUsableScore(citation.bm25_score)
      ? `关键词 ${formatCitationScore(citation.bm25_score)}`
      : null,
    isUsableScore(citation.retrieval_score)
      ? `召回 ${formatCitationScore(citation.retrieval_score)}`
      : null,
    citation.hit_type ? `命中类型 ${citation.hit_type}` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

const markdownPlugins = [remarkGfm];
type MessageMarkdownChildrenProps = Readonly<{ children?: ReactNode }>;
type MessageMarkdownLinkProps = Readonly<{
  href?: string;
  children?: ReactNode;
}>;
type MessageMarkdownImageProps = Readonly<{
  src?: string | Blob;
  alt?: string;
}>;
type MessageMarkdownCodeProps = Readonly<{
  className?: string;
  children?: ReactNode;
}>;

function MessageMarkdownParagraph({ children }: MessageMarkdownChildrenProps) {
  return (
    <p className="mb-2.5 text-body leading-[22px] last:mb-0">{children}</p>
  );
}

function MessageMarkdownList({ children }: MessageMarkdownChildrenProps) {
  return (
    <ul className="mb-2.5 list-disc space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ul>
  );
}

function MessageMarkdownOrderedList({
  children,
}: MessageMarkdownChildrenProps) {
  return (
    <ol className="mb-2.5 list-decimal space-y-1 pl-5 marker:text-muted-foreground">
      {children}
    </ol>
  );
}

function MessageMarkdownListItem({ children }: MessageMarkdownChildrenProps) {
  return <li className="pl-1">{children}</li>;
}

function MessageMarkdownAnchor({ href, children }: MessageMarkdownLinkProps) {
  const { onClick, onPrefetch } = useContext(InlineCitationHandlersContext);
  const inlineCitation = parseInlineCitationHref(href);
  if (inlineCitation) {
    return (
      <button
        type="button"
        onClick={() => onClick(href)}
        onMouseEnter={() => onPrefetch(href)}
        onFocus={() => onPrefetch(href)}
        className="inline-flex min-h-6 items-center rounded-[4px] border border-border bg-muted px-1.5 text-[0.85em] font-medium text-foreground no-underline transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>
    );
  }

  const safeHref = sanitizeMarkdownHref(href);
  if (!safeHref)
    return <span className="text-muted-foreground">{children}</span>;

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground font-medium underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function MessageMarkdownImage({ src, alt }: MessageMarkdownImageProps) {
  const raw = typeof src === "string" ? src : "";
  const resolved = resolveMarkdownImageSrc(raw);
  if (!resolved) return null;
  return (
    <AuthImage
      src={resolved}
      alt={alt || "image"}
      width={1200}
      height={800}
      unoptimized
      sizes="(max-width: 768px) 100vw, 768px"
      loading="lazy"
      className="my-3 h-auto max-h-96 w-full rounded-[4px] border border-border bg-background object-contain"
    />
  );
}

function MessageMarkdownBlockquote({ children }: MessageMarkdownChildrenProps) {
  return (
    <blockquote className="my-3 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  );
}

function MessageMarkdownPre({ children }: MessageMarkdownChildrenProps) {
  return (
    <pre className="my-3 overflow-x-auto rounded-[4px] border border-border bg-muted/40 p-3 text-compact leading-[20px]">
      {children}
    </pre>
  );
}

function MessageMarkdownCode({
  className,
  children,
  ...props
}: MessageMarkdownCodeProps) {
  const match = /language-(\w+)/.exec(className || "");
  if (match) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <code
      className={cn(
        "rounded-[4px] bg-muted px-1 py-0.5 font-mono text-compact text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}

const markdownBaseComponents = {
  a: MessageMarkdownAnchor,
  blockquote: MessageMarkdownBlockquote,
  code: MessageMarkdownCode,
  img: MessageMarkdownImage,
  li: MessageMarkdownListItem,
  ol: MessageMarkdownOrderedList,
  p: MessageMarkdownParagraph,
  pre: MessageMarkdownPre,
  ul: MessageMarkdownList,
};

function citationRowKey(citation: Citation, index: number): string {
  return `${citation.document_id}-${citation.chunk_id || citation.page_number || index}`;
}

const CitationRow = memo(function CitationRow({
  messageId,
  citation,
  index,
}: Readonly<{ messageId: string; citation: Citation; index: number }>) {
  const { openDocument } = useDocumentView();
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [hideImage, setHideImage] = useState(false);
  const prefetchedRef = useRef(false);
  const imgUrl = (() => {
    if (!citation.img_url) return null;
    return resolveSafeCitationImageUrl(citation.img_url);
  })();

  const isTableEvidence = (() => {
    const hitType = String(citation.hit_type || "")
      .trim()
      .toLowerCase();
    const chunkRole = String(citation.chunk_role || "")
      .trim()
      .toLowerCase();
    const semanticRole = String(citation.chunk_semantic_role || "")
      .trim()
      .toLowerCase();
    return (
      hitType === "tag" ||
      hitType === "table" ||
      chunkRole.includes("tag") ||
      chunkRole.includes("table") ||
      semanticRole === "table"
    );
  })();

  const canViewEvidence = Boolean(
    (citation.has_image && imgUrl && !hideImage) || isTableEvidence,
  );
  const sourceContext = buildChatCitationSourceContext(
    messageId,
    citation.document_id,
    citation.chunk_id,
    citation,
  );
  const citationScoreTitle = buildCitationScoreTitle(citation);
  const secondaryScore = getCitationSecondaryScore(citation);

  const handleClick = useCallback(() => {
    if (!citation.document_id) return;
    openDocument(
      citation.document_id,
      citation.chunk_id,
      getCitationRange(citation),
      {
        activeTab: "preview",
        previewAnchor: getDocumentPreviewAnchorFromCitation(citation),
        sourceContext,
      },
    );
  }, [citation, openDocument, sourceContext]);

  const handlePrefetch = useCallback(() => {
    if (prefetchedRef.current) return;
    if (!citation.document_id) return;

    prefetchedRef.current = true;
    prefetchDocumentView({
      documentId: citation.document_id,
      chunkId: citation.chunk_id,
      rawFileUrl: toAbsoluteBackendUrl(
        `/api/v1/documents/${citation.document_id}/download`,
      ),
    });
  }, [citation]);

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="flex items-center gap-1 px-1.5">
        <button
          type="button"
          onClick={handleClick}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[4px] px-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
          title={citationScoreTitle}
        >
          <span className="w-[18px] shrink-0 text-micro tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <span className="truncate text-compact text-foreground">
            {citation.document_name}
          </span>
          {citation.page_number == null ? null : (
            <span className="shrink-0 text-micro text-muted-foreground">
              P.{citation.page_number}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-micro tabular-nums text-muted-foreground">
            {formatCitationRankScore(citation.relevance_score)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="min-h-11 shrink-0 px-2 text-micro text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          {expanded ? "收起原文" : "原文"}
        </button>
        {canViewEvidence ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="min-h-11 shrink-0 px-2 text-micro text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
          >
            证据
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-border bg-muted/20 px-3 py-2">
          <p className="whitespace-pre-wrap text-caption leading-[18px] text-muted-foreground">
            {citation.chunk_content}
          </p>
          {secondaryScore ? (
            <p className="mt-1 text-micro text-muted-foreground">
              {secondaryScore.label} {secondaryScore.value}
            </p>
          ) : null}
          {citation.has_image && imgUrl && !hideImage ? (
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              className="relative mt-2 block aspect-video w-full overflow-hidden rounded-[4px] border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="打开证据查看器"
            >
              <AuthImage
                src={imgUrl}
                alt="引用图片"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 300px"
                className="object-cover"
                onError={() => setHideImage(true)}
              />
            </button>
          ) : null}
        </div>
      ) : null}

      <EvidenceViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        citation={viewerOpen ? citation : null}
        sourceContext={sourceContext}
      />
    </li>
  );
});

const CitationBlock = memo(function CitationBlock({
  messageId,
  citations,
  claimEvidence,
  onOpenEvidence,
}: Readonly<{
  messageId: string;
  citations: Citation[];
  claimEvidence: ClaimEvidenceItem[] | null;
  onOpenEvidence: (ev: ClaimEvidenceReference) => void;
}>) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(
    () =>
      citations
        .slice()
        .sort(
          (a, b) =>
            (Number(b.relevance_score) || 0) - (Number(a.relevance_score) || 0),
        ),
    [citations],
  );
  const citationByChunkId = useMemo(() => {
    const map = new Map<string, Citation>();
    for (const citation of citations) {
      if (
        citation &&
        typeof citation.chunk_id === "string" &&
        citation.chunk_id
      ) {
        map.set(citation.chunk_id, citation);
      }
    }
    return map;
  }, [citations]);
  const citationByDocumentId = useMemo(() => {
    const map = new Map<string, Citation>();
    for (const citation of citations) {
      if (
        citation &&
        typeof citation.document_id === "string" &&
        citation.document_id &&
        !map.has(citation.document_id)
      ) {
        map.set(citation.document_id, citation);
      }
    }
    return map;
  }, [citations]);

  const visibleRows = showAll ? rows : rows.slice(0, COLLAPSED_CITATION_COUNT);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);
  const evidenceItems = claimEvidence ?? [];

  if (rows.length === 0 && evidenceItems.length === 0) return null;

  return (
    <section
      className="mt-3 rounded-[4px] border border-border"
      data-chat-citations
    >
      <div className="flex min-h-8 items-center gap-2 border-b border-border bg-muted/40 px-3 text-micro text-muted-foreground">
        <span>来源 {rows.length} 条</span>
        <span className="ml-auto">按相关度排序</span>
      </div>

      <ul>
        {visibleRows.map((citation, index) => (
          <CitationRow
            key={citationRowKey(citation, index)}
            messageId={messageId}
            citation={citation}
            index={index}
          />
        ))}
      </ul>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="min-h-11 w-full border-t border-border px-3 text-left text-micro text-foreground hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          展开其余 {hiddenCount} 条
        </button>
      ) : null}

      {evidenceItems.length > 0 ? (
        <details className="border-t border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-micro text-muted-foreground [&::-webkit-details-marker]:hidden sm:min-h-8">
            <Database className="size-3 shrink-0" aria-hidden="true" />
            <span>证据 {evidenceItems.length} 条</span>
            <span className="ml-auto">展开</span>
          </summary>
          <div className="space-y-2 border-t border-border px-3 py-2">
            {evidenceItems.slice(0, 6).map((item, itemIndex) => {
              const claim = String(item?.claim || "").trim();
              const evidence = claimEvidenceReferences(item?.evidence);
              return (
                <div
                  key={
                    claim ||
                    evidence.map(claimEvidenceReferenceKey).join(":") ||
                    `claim-${itemIndex}`
                  }
                  className="border border-border bg-background p-2"
                >
                  <p className="text-caption font-medium leading-[18px] text-foreground">
                    {claim || `Claim #${itemIndex + 1}`}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {evidence.slice(0, 3).map((ev) => {
                      const docId =
                        typeof ev?.document_id === "string"
                          ? ev.document_id
                          : "";
                      const chunkId =
                        typeof ev?.chunk_id === "string" ? ev.chunk_id : "";
                      const citation =
                        (chunkId
                          ? citationByChunkId.get(chunkId)
                          : undefined) ||
                        (docId ? citationByDocumentId.get(docId) : undefined);
                      const score =
                        typeof ev?.score === "number" ? ev.score : null;
                      const quote = String(ev?.quote || "").trim();
                      const disabled = !docId;

                      return (
                        <button
                          key={`${docId}:${chunkId}:${quote.slice(0, 24)}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => onOpenEvidence(ev)}
                          className={cn(
                            "block min-h-11 w-full rounded-[4px] border border-border px-2 py-1.5 text-left transition-colors sm:min-h-8",
                            disabled
                              ? "cursor-not-allowed opacity-60"
                              : "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-micro font-medium text-foreground">
                                {citation?.document_name || docId || "未知文档"}
                              </span>
                              <span className="block text-micro tabular-nums text-muted-foreground">
                                {citation?.page_number == null
                                  ? "—"
                                  : `P.${citation.page_number}`}
                                {typeof ev?.start_char === "number" &&
                                typeof ev?.end_char === "number"
                                  ? ` · ${Math.trunc(ev.start_char)}-${Math.trunc(ev.end_char)}`
                                  : ""}
                              </span>
                            </span>
                            {score == null ? null : (
                              <span className="shrink-0 font-mono text-micro tabular-nums text-muted-foreground">
                                {score.toFixed(3)}
                              </span>
                            )}
                          </span>
                          {quote ? (
                            <span className="mt-1 line-clamp-2 block text-micro leading-4 text-muted-foreground">
                              {quote}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
});

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  isStreaming = false,
  variant = "default",
}: Readonly<{
  message: Message;
  isStreaming?: boolean;
  variant?: "default" | "minimal";
}>) {
  const router = useRouter();
  const isUser = message.role === "user";
  const isMinimal = variant === "minimal";
  const [copied, setCopied] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingSending, setRatingSending] = useState(false);
  const [feedbackRecord, setFeedbackRecord] = useState<MessageFeedback | null>(
    null,
  );
  const [expertAction, setExpertAction] = useState<
    "evidence" | "regression" | null
  >(null);
  const [stepsOpen, setStepsOpen] = useState(() => isStreaming);
  const copyTimerRef = useRef<number | null>(null);
  const prefetchedCitationTargetsRef = useRef<Set<string>>(new Set());
  const { openDocument } = useDocumentView();
  const stepCount = message.steps?.length ?? 0;
  const latestStep = stepCount > 0 ? message.steps?.[stepCount - 1] : "";
  const stepsPanelId = `chat-steps-${message.id}`;

  useEffect(() => {
    setStepsOpen(isStreaming);
  }, [isStreaming, message.id]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) {
        globalThis.window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    const text = (message.content || "").trimEnd();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      reportClientError("Failed to copy chat message to clipboard", error);
      toast.error("复制失败，请检查浏览器剪贴板权限");
      return;
    }

    setCopied(true);
    if (copyTimerRef.current != null) {
      globalThis.window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = globalThis.window.setTimeout(
      () => setCopied(false),
      1200,
    );
  };

  const handleCopyDiagnostics = useCallback(async () => {
    const payload = {
      message_id: message.id,
      message_metadata: message.message_metadata || null,
      citations: message.citations || [],
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {
      // ignore
    }
  }, [message.citations, message.id, message.message_metadata]);

  const metrics = message.message_metadata || {};
  const confidenceScoreRaw = metrics.confidence_score;
  const confidenceScore = (() => {
    const value =
      typeof confidenceScoreRaw === "number"
        ? confidenceScoreRaw
        : Number(confidenceScoreRaw);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
  })();
  const confidenceMeta = getConfidenceMeta(confidenceScore);
  const claimEvidence = claimEvidenceItems(metrics.claim_evidence);
  const claimEvidenceCount = claimEvidence?.length ?? 0;
  const messageDatasetId =
    typeof metrics.dataset_id === "string" && metrics.dataset_id.trim()
      ? metrics.dataset_id.trim()
      : null;
  const followupQuestions = Array.isArray(metrics.followup_questions)
    ? metrics.followup_questions
        .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
        .filter((item: string) => item.length > 0)
        .slice(0, 3)
    : [];
  const metricEntries = [
    { k: "request_id", v: metrics.request_id },
    {
      k: "retrieval_mode",
      v: metrics.retrieval_mode ?? metrics.retrieval_mode_requested,
    },
    { k: "vector_backend", v: metrics.vector_backend },
    { k: "route", v: metrics.route ?? metrics.model_route },
    { k: "elapsed_sec", v: metrics.elapsed_sec },
    { k: "retrieval_elapsed_sec", v: metrics.retrieval_elapsed_sec },
    { k: "generation_elapsed_sec", v: metrics.generation_elapsed_sec },
    { k: "docs_returned", v: metrics.docs_returned },
    { k: "distinct_documents", v: metrics.distinct_documents },
    { k: "top_k", v: metrics.top_k },
  ].flatMap((entry) => {
    const value = formatMetricValue(entry.v);
    return value == null ? [] : [{ k: entry.k, value }];
  });

  const elapsedLabel = (() => {
    const value = Number(metrics.elapsed_sec);
    return Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}s` : null;
  })();
  const tokenLabel = (() => {
    const value = Number(metrics.total_tokens);
    return Number.isFinite(value) && value > 0
      ? `${Math.round(value).toLocaleString("zh-CN")} tokens`
      : null;
  })();

  const citationRows = (message.citations || [])
    .slice()
    .sort(
      (a, b) =>
        (Number(b.relevance_score) || 0) - (Number(a.relevance_score) || 0),
    );

  const citationByChunkId = (() => {
    const map = new Map<string, Citation>();
    for (const c of message.citations || []) {
      if (c && typeof c.chunk_id === "string" && c.chunk_id) {
        map.set(c.chunk_id, c);
      }
    }
    return map;
  })();

  const citationByDocumentId = (() => {
    const map = new Map<string, Citation>();
    for (const c of message.citations || []) {
      if (
        c &&
        typeof c.document_id === "string" &&
        c.document_id &&
        !map.has(c.document_id)
      ) {
        map.set(c.document_id, c);
      }
    }
    return map;
  })();

  const handleOpenEvidence = useCallback(
    (ev: ClaimEvidenceReference) => {
      const docId = typeof ev?.document_id === "string" ? ev.document_id : "";
      if (!docId) return;
      const chunkId =
        typeof ev?.chunk_id === "string" && ev.chunk_id
          ? ev.chunk_id
          : undefined;
      const start = typeof ev?.start_char === "number" ? ev.start_char : null;
      const end = typeof ev?.end_char === "number" ? ev.end_char : null;
      const range =
        start != null && end != null && end > start
          ? { start, end }
          : undefined;
      openDocument(docId, chunkId, range, {
        sourceContext: buildChatCitationSourceContext(
          message.id,
          docId,
          chunkId,
        ),
      });
    },
    [message.id, openDocument],
  );

  const handleFollowupPrefill = useCallback((question: string) => {
    const prompt = question.trim();
    if (!prompt) return;
    globalEventBus.emit("chat:submit", prompt);
  }, []);

  const handleInlineCitationClick = useCallback(
    (href?: string) => {
      const target = parseInlineCitationHref(href);
      if (!target) return;

      const citation =
        (target.chunkId ? citationByChunkId.get(target.chunkId) : undefined) ||
        (target.documentId
          ? citationByDocumentId.get(target.documentId)
          : undefined);

      const documentId = citation?.document_id || target.documentId;
      if (!documentId) return;

      openDocument(
        documentId,
        citation?.chunk_id || target.chunkId,
        citation ? getCitationRange(citation) : undefined,
        {
          activeTab: "preview",
          previewAnchor: getDocumentPreviewAnchorFromCitation(citation),
          sourceContext: buildChatCitationSourceContext(
            message.id,
            documentId,
            citation?.chunk_id || target.chunkId,
            citation,
          ),
        },
      );
    },
    [citationByChunkId, citationByDocumentId, message.id, openDocument],
  );

  const prefetchCitationTarget = useCallback(
    (
      citation?: Citation | null,
      target?: { documentId?: string; chunkId?: string } | null,
    ) => {
      const documentId = citation?.document_id || target?.documentId;
      if (!documentId) return;

      const chunkId = citation?.chunk_id || target?.chunkId;
      const cacheKey = `${documentId}:${chunkId || ""}`;
      if (prefetchedCitationTargetsRef.current.has(cacheKey)) return;
      prefetchedCitationTargetsRef.current.add(cacheKey);

      prefetchDocumentView({
        documentId,
        chunkId,
        rawFileUrl: toAbsoluteBackendUrl(
          `/api/v1/documents/${documentId}/download`,
        ),
      });
    },
    [],
  );

  const handleInlineCitationPrefetch = useCallback(
    (href?: string) => {
      const target = parseInlineCitationHref(href);
      if (!target) return;

      const citation =
        (target.chunkId ? citationByChunkId.get(target.chunkId) : undefined) ||
        (target.documentId
          ? citationByDocumentId.get(target.documentId)
          : undefined);

      prefetchCitationTarget(citation, target);
    },
    [citationByChunkId, citationByDocumentId, prefetchCitationTarget],
  );

  const inlineCitationHandlers = useMemo<InlineCitationHandlers>(
    () => ({
      onClick: handleInlineCitationClick,
      onPrefetch: handleInlineCitationPrefetch,
    }),
    [handleInlineCitationClick, handleInlineCitationPrefetch],
  );

  const renderedContent = useMemo<ReactNode>(() => {
    if (isUser) {
      return (
        <div className="whitespace-pre-wrap text-body leading-[22px] text-foreground">
          {message.content}
        </div>
      );
    }
    return (
      <InlineCitationHandlersContext.Provider value={inlineCitationHandlers}>
        <ReactMarkdown
          remarkPlugins={markdownPlugins}
          skipHtml
          components={markdownBaseComponents}
        >
          {message.content}
        </ReactMarkdown>
      </InlineCitationHandlersContext.Provider>
    );
  }, [inlineCitationHandlers, isUser, message.content]);

  const canRate = (() => {
    if (isUser) return false;
    if (isStreaming) return false;
    // Feedback API requires persisted assistant message UUID.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      message.id,
    );
  })();

  const submitRating = useCallback(
    async (nextRating: number) => {
      if (!canRate) return;
      if (ratingSending) return;
      setRating(nextRating);
      setRatingSending(true);
      try {
        const created = await feedbackApi.create({
          message_id: message.id,
          rating: nextRating,
        });
        setFeedbackRecord(created);
        toast.success("已提交反馈");
      } catch (err: unknown) {
        toast.error(formatApiError(err, "反馈提交失败"));
      } finally {
        setRatingSending(false);
      }
    },
    [canRate, message.id, ratingSending],
  );

  const submitFeedbackCategory = useCallback(
    async (category: FeedbackCategory) => {
      if (!canRate || rating == null || rating > 2 || ratingSending) return;
      setRatingSending(true);
      try {
        const updated = await feedbackApi.create({
          message_id: message.id,
          rating,
          category,
          reason: feedbackRecord?.reason,
          tags: feedbackRecord?.tags,
          expected_answer: feedbackRecord?.expected_answer,
        });
        setFeedbackRecord(updated);
        toast.success("已记录问题分类");
      } catch (err: unknown) {
        toast.error(formatApiError(err, "问题分类提交失败"));
      } finally {
        setRatingSending(false);
      }
    },
    [canRate, feedbackRecord, message.id, rating, ratingSending],
  );

  const resolveFeedbackDatasetId = useCallback(async () => {
    if (messageDatasetId) return messageDatasetId;

    const firstDocumentId = (message.citations || []).find(
      (citation) => citation.document_id,
    )?.document_id;
    if (!firstDocumentId) return null;

    const document = await documentApi.get(firstDocumentId, {
      includeChunks: false,
    });
    return typeof document.dataset_id === "string" && document.dataset_id.trim()
      ? document.dataset_id.trim()
      : null;
  }, [message.citations, messageDatasetId]);

  const handleSendFeedbackToEvidence = useCallback(async () => {
    const feedbackId = String(feedbackRecord?.id || "").trim();
    if (!feedbackId) return;
    if (expertAction) return;

    setExpertAction("evidence");
    try {
      const datasetId = await resolveFeedbackDatasetId();
      if (!datasetId) {
        toast.error("未解析到数据集，暂时无法打开证据库");
        return;
      }
      router.push(
        `/datasets/${encodeURIComponent(datasetId)}/evidence?feedback_id=${encodeURIComponent(feedbackId)}`,
      );
    } catch (error: unknown) {
      toast.error(formatApiError(error, "打开证据库失败"));
    } finally {
      setExpertAction(null);
    }
  }, [expertAction, feedbackRecord?.id, resolveFeedbackDatasetId, router]);

  const handleCreateRegressionCase = useCallback(async () => {
    const feedbackId = String(feedbackRecord?.id || "").trim();
    if (!feedbackId) return;
    if (expertAction) return;

    setExpertAction("regression");
    try {
      await feedbackApi.toRegressionCase(feedbackId, {
        include_document_scope: true,
        extra: { source: "chat_feedback_action" },
      });
      toast.success("已创建回归用例");
    } catch (error: unknown) {
      toast.error(formatApiError(error, "转为回归用例失败"));
    } finally {
      setExpertAction(null);
    }
  }, [expertAction, feedbackRecord?.id]);

  const speaker = isUser ? "你" : "MimirQ";
  const hasDiagnostics = !isUser && Boolean(message.message_metadata);
  const hasCitations =
    !isUser && (citationRows.length > 0 || claimEvidenceCount > 0);
  const metaParts = [elapsedLabel, tokenLabel].filter((part): part is string =>
    Boolean(part),
  );

  return (
    <div
      data-chat-message-layout={isMinimal ? undefined : "flat"}
      className={cn(
        "group text-body",
        isMinimal
          ? cn("flex gap-3", isUser ? "justify-end pb-4" : "justify-start")
          : "flex gap-3 py-3.5",
      )}
    >
      {!isUser && isMinimal ? (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted text-micro font-semibold text-foreground">
          M
        </div>
      ) : !isUser ? (
        <div
          data-chat-speaker
          className="w-11 shrink-0 pt-0.5 text-caption font-medium text-muted-foreground"
        >
          MimirQ
        </div>
      ) : null}

      {isUser && !isMinimal ? (
        <div
          data-chat-speaker
          className="w-11 shrink-0 pt-0.5 text-caption font-medium text-muted-foreground"
        >
          {speaker}
        </div>
      ) : null}

      <div
        className={cn(
          "min-w-0",
          isMinimal
            ? cn(
                "flex-1 border border-border px-3 py-2",
                isUser ? "max-w-[78%] bg-muted" : "max-w-[88%] bg-surface",
              )
            : "flex-1",
        )}
      >
        {!isUser && stepCount > 0 ? (
          <div className="mb-2.5 rounded-[4px] border border-border">
            <button
              type="button"
              aria-expanded={stepsOpen}
              aria-controls={stepsPanelId}
              onClick={() => setStepsOpen((open) => !open)}
              className="flex min-h-11 w-full items-center gap-2 px-2.5 py-1.5 text-left text-caption text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
            >
              <span className="font-medium text-foreground">思考路径</span>
              <span>{stepCount} 步</span>
              {!stepsOpen && latestStep ? (
                <span className="min-w-0 truncate">{latestStep}</span>
              ) : null}
              <ChevronDown
                className={cn(
                  "ml-auto size-3.5 shrink-0 transition-transform duration-120 motion-reduce:transition-none",
                  stepsOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {stepsOpen ? (
              <div
                id={stepsPanelId}
                className="space-y-1 border-t border-border px-2.5 py-2 text-caption text-muted-foreground"
              >
                {message.steps?.map((step, index) => (
                  <p
                    key={`${index}-${step}`}
                    className={cn(
                      index === stepCount - 1 && isStreaming
                        ? "font-medium text-foreground"
                        : "",
                    )}
                  >
                    {step}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {renderedContent}

        {hasCitations ? (
          <CitationBlock
            messageId={message.id}
            citations={citationRows}
            claimEvidence={claimEvidence}
            onOpenEvidence={handleOpenEvidence}
          />
        ) : null}

        {!isUser && followupQuestions.length > 0 ? (
          <div className="mt-2.5 border-t border-border pt-2">
            <p className="mb-1.5 text-micro text-muted-foreground">继续追问</p>
            <div className="flex flex-wrap gap-1.5">
              {followupQuestions.map((question) => (
                <Button
                  key={question}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleFollowupPrefill(question)}
                  className="h-auto min-h-11 whitespace-normal px-2.5 py-1.5 text-left text-caption leading-[18px] sm:min-h-7"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2 text-micro text-muted-foreground">
          {metaParts.length > 0 ? (
            <span className="tabular-nums">{metaParts.join(" · ")}</span>
          ) : null}
          {confidenceMeta && confidenceScore != null ? (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-[4px] border px-1.5 font-medium",
                confidenceMeta.badgeClass,
              )}
              title={confidenceMeta.summary}
            >
              置信度 {Math.round(confidenceScore * 100)}% ·{" "}
              {confidenceMeta.label}
            </span>
          ) : null}
          {isStreaming ? <span>生成中…</span> : null}

          <span className="ml-auto flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => detachPromise(handleCopy())}
              disabled={isStreaming || !message.content.trim()}
              aria-label={copied ? "已复制" : "复制回答"}
              className="min-h-11 px-2 text-micro sm:min-h-7"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "已复制" : "复制"}
            </Button>
            {hasDiagnostics ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDiagOpen(true)}
                className="min-h-11 px-2 text-micro sm:min-h-7"
              >
                <BarChart3 className="size-3.5" />
                诊断
              </Button>
            ) : null}
            {canRate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFeedbackOpen((open) => !open)}
                aria-expanded={feedbackOpen}
                className="min-h-11 px-2 text-micro sm:min-h-7"
              >
                <Star className="size-3.5" />
                反馈
              </Button>
            ) : null}
          </span>
        </div>

        {!isUser && canRate && feedbackOpen ? (
          <div className="mt-2 rounded-[4px] border border-border bg-muted/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-micro text-muted-foreground">
                用 1-5
                星记录这条回答是否有帮助；评分越低越适合进入回归或证据工作台继续分析。
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = rating != null && value <= rating;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={ratingSending}
                      onClick={() => detachPromise(submitRating(value))}
                      className={cn(
                        "inline-flex size-11 items-center justify-center rounded-[4px] transition-colors sm:size-8",
                        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        ratingSending && "cursor-not-allowed opacity-50",
                      )}
                      aria-label={`rate-${value}`}
                      title={`${value} 星`}
                    >
                      <Star
                        className={cn(
                          "size-4",
                          active ? "text-warning" : "text-muted-foreground",
                        )}
                        fill={active ? "currentColor" : "none"}
                      />
                    </button>
                  );
                })}
                {ratingSending ? (
                  <span className="ml-1 text-micro text-muted-foreground">
                    提交中…
                  </span>
                ) : null}
              </div>
            </div>

            {rating != null && rating <= 2 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                <span className="text-micro text-muted-foreground">
                  主要问题
                </span>
                {(
                  [
                    ["retrieval_miss", "没找到"],
                    ["wrong_answer", "答错了"],
                    ["out_of_scope", "超出范围"],
                  ] as const
                ).map(([category, label]) => (
                  <Button
                    key={category}
                    type="button"
                    size="sm"
                    variant={
                      feedbackRecord?.category === category
                        ? "default"
                        : "outline"
                    }
                    disabled={ratingSending}
                    onClick={() =>
                      detachPromise(submitFeedbackCategory(category))
                    }
                    className="min-h-11 px-2.5 text-micro sm:min-h-7"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            ) : null}

            {feedbackRecord?.id ? (
              <div className="mt-2 border-t border-border pt-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-micro font-medium text-foreground">
                      已写入 expert loop
                    </p>
                    <p className="break-all font-mono text-micro text-muted-foreground">
                      feedback_id={feedbackRecord.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        detachPromise(handleSendFeedbackToEvidence())
                      }
                      disabled={expertAction != null}
                      className="min-h-11 gap-1.5 px-2.5 text-micro sm:min-h-7"
                    >
                      {expertAction === "evidence" ? (
                        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Database className="size-3.5" />
                      )}
                      送入证据库
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        detachPromise(handleCreateRegressionCase())
                      }
                      disabled={expertAction != null}
                      className="min-h-11 gap-1.5 px-2.5 text-micro sm:min-h-7"
                    >
                      {expertAction === "regression" ? (
                        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <TestTube2 className="size-3.5" />
                      )}
                      转为回归用例
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isUser && isMinimal ? (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted text-micro font-semibold text-foreground">
          你
        </div>
      ) : null}

      {hasDiagnostics ? (
        <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
          <DialogContent className="max-w-4xl overflow-hidden border border-border bg-popover p-0 text-popover-foreground">
            <DialogHeader className="border-b border-border bg-surface px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="flex items-center gap-2 text-compact">
                  <BarChart3
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>
                    检索诊断
                    <span className="ml-2 text-micro font-normal text-muted-foreground">
                      message_metadata / citations（仅用于调试）
                    </span>
                  </span>
                </DialogTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => detachPromise(handleCopyDiagnostics())}
                  className="text-micro"
                >
                  <Copy className="size-3.5" />
                  复制 JSON
                </Button>
              </div>
            </DialogHeader>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto overscroll-contain p-4 md:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="space-y-4 md:col-span-5">
                  <div className="overflow-hidden rounded-[4px] border border-border bg-surface">
                    <div className="border-b border-border bg-muted/30 px-3 py-2 text-micro font-medium text-foreground">
                      元数据
                    </div>
                    <div className="space-y-3 p-3">
                      <div>
                        <div className="mb-1 text-micro text-muted-foreground">
                          Message ID
                        </div>
                        <div className="select-all break-all rounded-[4px] border border-border bg-background p-2 font-mono text-micro tabular-nums">
                          {message.id}
                        </div>
                      </div>
                      {metricEntries.length ? (
                        <dl className="space-y-1.5 text-micro">
                          {metricEntries.map((entry) => (
                            <div
                              key={entry.k}
                              className="flex items-start justify-between gap-3"
                            >
                              <dt className="text-muted-foreground">
                                {entry.k}
                              </dt>
                              <dd className="break-all text-right font-mono tabular-nums text-foreground">
                                {entry.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <div className="text-micro text-muted-foreground">
                          无可用指标。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[4px] border border-border bg-surface">
                    <div className="border-b border-border bg-muted/30 px-3 py-2 text-micro font-medium text-foreground">
                      Raw payload
                    </div>
                    <pre className="max-h-56 overflow-auto p-3 text-micro tabular-nums text-muted-foreground">
                      {JSON.stringify(
                        { message_metadata: message.message_metadata || null },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-7">
                  <div className="flex min-h-[300px] flex-col overflow-hidden rounded-[4px] border border-border bg-surface">
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
                      <div className="text-micro font-medium text-foreground">
                        引用来源
                      </div>
                      <div className="text-micro tabular-nums text-muted-foreground">
                        {citationRows.length} 条
                      </div>
                    </div>

                    {citationRows.length ? (
                      <div className="flex-1 overflow-x-auto">
                        <table
                          aria-label="消息引用明细"
                          className="w-full text-left text-micro tabular-nums"
                        >
                          <thead className="text-muted-foreground">
                            <tr className="border-b border-border">
                              <th className="px-3 py-2 font-medium">#</th>
                              <th className="px-3 py-2 font-medium">
                                Document / Source
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Page
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Score
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Vector
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                BM25
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Rerank
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {citationRows.map((citation, index) => {
                              const score = Number(citation.relevance_score);
                              return (
                                <tr
                                  key={citationRowKey(citation, index)}
                                  className="transition-colors hover:bg-muted/30"
                                >
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {index + 1}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div
                                      className="max-w-[240px] truncate font-medium text-foreground"
                                      title={citation.document_name}
                                    >
                                      {citation.document_name}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {citation.page_number ?? "-"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold">
                                    {Number.isFinite(score)
                                      ? score.toFixed(3)
                                      : "-"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {citation.vector_score == null
                                      ? "-"
                                      : Number(citation.vector_score).toFixed(
                                          3,
                                        )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {citation.bm25_score == null
                                      ? "-"
                                      : Number(citation.bm25_score).toFixed(3)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {citation.rerank_score == null
                                      ? "-"
                                      : Number(citation.rerank_score).toFixed(
                                          3,
                                        )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center p-6 text-caption text-muted-foreground">
                        未记录 citations
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-[240px] flex-col overflow-hidden rounded-[4px] border border-border bg-surface">
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
                      <div className="text-micro font-medium text-foreground">
                        Claim Evidence
                      </div>
                      <div className="text-micro tabular-nums text-muted-foreground">
                        {claimEvidence ? `${claimEvidence.length} 条` : "-"}
                      </div>
                    </div>

                    {claimEvidence?.length ? (
                      <div className="max-h-72 space-y-2 overflow-auto p-3">
                        {claimEvidence.slice(0, 24).map((item, index) => {
                          const claim = String(item?.claim || "").trim();
                          const evidence = claimEvidenceReferences(
                            item?.evidence,
                          );
                          return (
                            <div
                              key={
                                claim ||
                                evidence
                                  .map(claimEvidenceReferenceKey)
                                  .join(":") ||
                                `diag-claim-${index}`
                              }
                              className="rounded-[4px] border border-border bg-background p-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="line-clamp-3 min-w-0 text-micro font-medium leading-4 text-foreground">
                                  {claim || `Claim #${index + 1}`}
                                </div>
                                <div className="shrink-0 text-micro tabular-nums text-muted-foreground">
                                  {evidence.length} 证据
                                </div>
                              </div>
                              {evidence.length ? (
                                <div className="mt-1.5 space-y-1">
                                  {evidence.slice(0, 3).map((ev) => {
                                    const docId =
                                      typeof ev?.document_id === "string"
                                        ? ev.document_id
                                        : "";
                                    const chunkId =
                                      typeof ev?.chunk_id === "string"
                                        ? ev.chunk_id
                                        : "";
                                    const citation =
                                      (chunkId
                                        ? citationByChunkId.get(chunkId)
                                        : undefined) ||
                                      (docId
                                        ? citationByDocumentId.get(docId)
                                        : undefined);
                                    const score =
                                      typeof ev?.score === "number"
                                        ? ev.score
                                        : null;
                                    const quote = String(
                                      ev?.quote || "",
                                    ).trim();
                                    const disabled = !docId;
                                    return (
                                      <button
                                        key={`${docId}:${chunkId}:${quote.slice(0, 24)}`}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => handleOpenEvidence(ev)}
                                        className={cn(
                                          "block w-full rounded-[4px] border border-border px-2 py-1.5 text-left transition-colors",
                                          disabled
                                            ? "cursor-not-allowed opacity-60"
                                            : "hover:bg-muted/40",
                                        )}
                                      >
                                        <span className="flex items-start justify-between gap-2">
                                          <span className="min-w-0">
                                            <span
                                              className="block truncate text-micro font-medium text-foreground"
                                              title={
                                                citation?.document_name ||
                                                docId ||
                                                "Unknown"
                                              }
                                            >
                                              {citation?.document_name ||
                                                docId ||
                                                "Unknown"}
                                            </span>
                                            <span className="block text-micro tabular-nums text-muted-foreground">
                                              {citation?.page_number == null
                                                ? "—"
                                                : `P.${citation.page_number}`}
                                              {typeof ev?.start_char ===
                                                "number" &&
                                              typeof ev?.end_char === "number"
                                                ? ` · ${Math.trunc(ev.start_char)}-${Math.trunc(ev.end_char)}`
                                                : ""}
                                            </span>
                                          </span>
                                          {score == null ? null : (
                                            <span className="shrink-0 font-mono text-micro tabular-nums text-muted-foreground">
                                              {score.toFixed(3)}
                                            </span>
                                          )}
                                        </span>
                                        {quote ? (
                                          <span className="mt-1 line-clamp-2 block text-micro leading-4 text-muted-foreground">
                                            {quote}
                                          </span>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="mt-1.5 text-micro text-muted-foreground">
                                  未找到可见证据。
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center p-6 text-center text-caption text-muted-foreground">
                        未记录 Claim Evidence
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
});
