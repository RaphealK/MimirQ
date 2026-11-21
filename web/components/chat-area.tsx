/**
 * 主对话区域组件
 *
 * Engineering reading layout: 720px conversation column, flat messages with a
 * speaker column, citations attached to the answer, and a 200px retrieval rail
 * on wide screens. The rail becomes a sheet on narrow screens and when the
 * document viewer is open.
 */
"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, Send, Settings2, StopCircle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { datasetApi, promptTemplateApi, settingsApi } from "@/lib/api";
import { ChatMessageItem } from "@/components/chat/message-item";
import {
  RetrievalSettingsPanel,
  type ChatRetrievalConfig,
  type MetadataFilterMode,
  type RetrievalRerankStatus,
} from "@/components/chat/retrieval-settings-panel";
import { VoiceModeOverlay } from "@/components/chat/voice-mode-overlay";
import { ConversationSummaryDialog } from "@/components/chat/conversation-summary-dialog";
import { RagTraceDialog } from "@/components/rag-trace/rag-trace-dialog";
import getCaretCoordinates from "textarea-caret";
import { SlashMenu } from "@/components/chat/slash-menu";
import { globalEventBus } from "@/lib/event-bus";
import { useRouter } from "@/i18n/navigation";
import { queryKeys } from "@/lib/query-keys";
import { reportClientError } from "@/lib/client-logging";
import { useDocumentView } from "@/store/document-view";

const DEFAULT_VISIBLE_MESSAGES = 80;
const LOAD_MORE_STEP = 40;
const CHAT_PROMPT_TEMPLATE_PARAMS = { is_active: true, limit: 50 };

function renderComposerSlash(chunks: ReactNode) {
  return <span className="font-mono text-foreground">{chunks}</span>;
}

function renderComposerEnter(chunks: ReactNode) {
  return <span className="font-medium text-foreground">{chunks}</span>;
}

function escapeAttributeSelector(value: string): string {
  if (typeof globalThis.CSS?.escape === "function") {
    return globalThis.CSS.escape(value);
  }
  return String(value).replace(/["\\\]]/g, String.raw`\$&`);
}

export function ChatArea({
  initialConversationId,
  initialPrompt,
  initialAutoSendPrompt,
  initialOpenRagSettings,
  onConversationId,
  onPromptConsumed,
}: Readonly<{
  initialConversationId?: string;
  initialPrompt?: string;
  initialAutoSendPrompt?: boolean;
  initialOpenRagSettings?: boolean;
  onConversationId?: (conversationId: string) => void;
  onPromptConsumed?: () => void;
}> = {}) {
  const router = useRouter();
  const t = useTranslations("Chat");
  const activeDocumentId = useDocumentView((state) => state.documentId);
  const isDocumentViewerOpen = useDocumentView((state) => state.isOpen);
  const summaryMemoryId = "chat-enable-summary-memory";
  const [inputValue, setInputValue] = useState(() =>
    (initialPrompt || "").trim(),
  );
  const [promptTemplateId, setPromptTemplateId] = useState<string>("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [deepReasoningEnabled, setDeepReasoningEnabled] = useState(false);
  const [hasSystemRagDefaults, setHasSystemRagDefaults] = useState(false);
  const [ragConfigDirty, setRagConfigDirty] = useState(false);
  const [ragConfig, setRagConfig] = useState<ChatRetrievalConfig>(() => ({
    top_k: 5,
    score_threshold: 0.7,
    retrieval_mode: "hybrid",
    use_graph: false,
    enable_multi_query: false,
    enable_hyde: false,
    metadata_filter: undefined,
  }));
  const [metadataFilterMode, setMetadataFilterMode] =
    useState<MetadataFilterMode>("all");
  const [metadataFilterText, setMetadataFilterText] = useState("");
  const [metadataFilterError, setMetadataFilterError] = useState<string | null>(
    null,
  );
  const [structuredOutput, setStructuredOutput] = useState(false);
  const [structuredPreset, setStructuredPreset] = useState<string>("");
  const [enableLongTermMemory, setEnableLongTermMemory] = useState(false);
  const [enableSummaryMemory, setEnableSummaryMemory] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [traceDialogOpen, setTraceDialogOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_MESSAGES);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const retrievalPanelRef = useRef<HTMLElement>(null);
  const reflectedConversation = useRef<string | null>(null);
  const publishConversation = useCallback((id: string) => {
    if (id === initialConversationId) return;
    reflectedConversation.current = id;
    onConversationId?.(id);
  }, [initialConversationId, onConversationId]);
  const autoScrollRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollEventRafRef = useRef<number | null>(null);
  const focusMessageTimerRef = useRef<number | null>(null);
  const pendingPrependScrollRef = useRef<{
    top: number;
    height: number;
  } | null>(null);
  const autoSendPromptRef = useRef(false);
  const initialRagSettingsHandledRef = useRef(false);
  // Slash Menu State
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const activeDocumentIds = useMemo(
    () => (activeDocumentId ? [activeDocumentId] : undefined),
    [activeDocumentId],
  );

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.snapshot,
    queryFn: () => settingsApi.get(),
    staleTime: 60_000,
  });

  const datasetsQuery = useQuery({
    queryKey: queryKeys.datasets.exhaustive({ purpose: "chat-rag-settings" }),
    queryFn: () => datasetApi.listAll(),
    staleTime: 60_000,
  });

  const promptTemplatesQuery = useQuery({
    queryKey: queryKeys.prompts.list(CHAT_PROMPT_TEMPLATE_PARAMS),
    queryFn: async () => {
      const response = await promptTemplateApi.list(
        CHAT_PROMPT_TEMPLATE_PARAMS,
      );
      return response.items || [];
    },
    staleTime: 60_000,
  });

  const datasets = useMemo(
    () => datasetsQuery.data ?? [],
    [datasetsQuery.data],
  );
  const promptTemplates = useMemo(
    () => promptTemplatesQuery.data || [],
    [promptTemplatesQuery.data],
  );
  const datasetsLoading = datasetsQuery.isLoading;
  const focusMessageById = useCallback((messageId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const node = container.querySelector<HTMLElement>(
      `[data-chat-message-id="${escapeAttributeSelector(messageId)}"]`,
    );
    if (!node) return false;

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.focus({ preventScroll: true });
    setFocusedMessageId(messageId);
    if (focusMessageTimerRef.current != null) {
      globalThis.window.clearTimeout(focusMessageTimerRef.current);
    }
    focusMessageTimerRef.current = globalThis.window.setTimeout(() => {
      setFocusedMessageId((current) =>
        current === messageId ? null : current,
      );
      focusMessageTimerRef.current = null;
    }, 1800);
    return true;
  }, []);

  useEffect(() => {
    const system = settingsQuery.data;
    if (!system || hasSystemRagDefaults) return;

    setHasSystemRagDefaults(true);
    setRagConfig((prev) => {
      const isDefault =
        prev.top_k === 5 &&
        prev.score_threshold === 0.7 &&
        prev.retrieval_mode === "hybrid" &&
        prev.use_graph === false;
      if (!isDefault) return prev;
      return {
        ...prev,
        top_k: system.rag?.retrieval_top_k ?? prev.top_k,
        score_threshold:
          system.rag?.similarity_threshold ?? prev.score_threshold,
      };
    });
  }, [hasSystemRagDefaults, settingsQuery.data]);

  useEffect(() => {
    setSelectedDatasetId((current) => {
      const trimmed = String(current || "").trim();
      if (trimmed && datasets.some((dataset) => dataset.id === trimmed))
        return trimmed;
      return String(datasets[0]?.id || "");
    });
  }, [datasets]);

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId),
    [datasets, selectedDatasetId],
  );

  const rerankStatus = useMemo<RetrievalRerankStatus | null>(() => {
    const rag = settingsQuery.data?.rag;
    if (!rag) return null;
    return {
      enabled: Boolean(rag.enable_reranker),
      provider: rag.reranker_provider ? String(rag.reranker_provider) : null,
      topN: Number.isFinite(rag.reranker_top_n)
        ? Number(rag.reranker_top_n)
        : null,
      weightRerank: Boolean(rag.enable_weight_rerank),
    };
  }, [settingsQuery.data]);

  const applyMetadataFilterPreset = useCallback((mode: MetadataFilterMode) => {
    setMetadataFilterMode(mode);
    setRagConfigDirty(true);
    setMetadataFilterError(null);

    if (mode === "all") {
      setMetadataFilterText("");
      setRagConfig((prev) => ({ ...prev, metadata_filter: undefined }));
      return;
    }

    if (mode === "exclude_qa") {
      const filter = { file_type: { $ne: "qa" } };
      setMetadataFilterText(JSON.stringify(filter, null, 2));
      setRagConfig((prev) => ({ ...prev, metadata_filter: filter }));
      return;
    }

    if (mode === "qa_only") {
      const filter = { file_type: { $eq: "qa" } };
      setMetadataFilterText(JSON.stringify(filter, null, 2));
      setRagConfig((prev) => ({ ...prev, metadata_filter: filter }));
    }

    // custom: keep current JSON text; parsing happens in an effect.
  }, []);

  useEffect(() => {
    if (metadataFilterMode !== "custom") return;

    const raw = (metadataFilterText || "").trim();
    if (!raw) {
      setMetadataFilterError(null);
      setRagConfig((prev) => ({ ...prev, metadata_filter: undefined }));
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setMetadataFilterError(t("metadataFilterObjectError"));
        setRagConfig((prev) => ({ ...prev, metadata_filter: undefined }));
        return;
      }
      setMetadataFilterError(null);
      setRagConfig((prev) => ({ ...prev, metadata_filter: parsed }));
    } catch {
      setMetadataFilterError(t("metadataFilterInvalidJson"));
      setRagConfig((prev) => ({ ...prev, metadata_filter: undefined }));
    }
  }, [metadataFilterMode, metadataFilterText, t]);

  const handleKeyUp = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "/") {
      const el = e.currentTarget;
      const caret = getCaretCoordinates(el, el.selectionEnd);
      const rect = el.getBoundingClientRect();
      setSlashPos({
        top: rect.top + caret.top + 20, // offset
        left: rect.left + caret.left,
      });
      setSlashOpen(true);
    }
  }, []);

  const handlePrefillInput = useCallback((nextValue: string) => {
    const prompt = nextValue.trim();
    if (!prompt) return;

    setInputValue(prompt);
    setSlashOpen(false);

    globalThis.window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = prompt.length;
      textarea.setSelectionRange(end, end);
    });
  }, []);

  const updateRagConfig = useCallback((patch: Partial<ChatRetrievalConfig>) => {
    setRagConfigDirty(true);
    setRagConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const openRetrievalSettings = useCallback(() => {
    if (globalThis.window === undefined) return;
    if (
      globalThis.window.matchMedia("(min-width: 1024px)").matches &&
      !isDocumentViewerOpen
    ) {
      const panel = retrievalPanelRef.current;
      if (panel) {
        panel.focus({ preventScroll: true });
        panel.scrollIntoView({ block: "nearest" });
        return;
      }
    }
    setSettingsSheetOpen(true);
  }, [isDocumentViewerOpen]);

  const openCommandMenu = useCallback((query = "") => {
    globalEventBus.emit("command-menu:set-open", { open: true, query });
  }, []);

  const handleSlashSelect = useCallback(
    (cmd: string) => {
      setSlashOpen(false);

      if (cmd === "knowledge") {
        router.push("/knowledge");
        return;
      }

      if (cmd === "history") {
        router.push("/history");
        return;
      }

      if (cmd === "prompt") {
        handlePrefillInput(t("slashPromptSummary"));
        return;
      }

      if (cmd === "cite_analysis") {
        handlePrefillInput(t("slashPromptCiteAnalysis"));
        return;
      }

      if (cmd === "config") {
        openRetrievalSettings();
        toast.info(t("openRagConfig"));
        return;
      }

      if (cmd === "clear") {
        setInputValue("");
        toast.info(t("clearInput"));
      }
    },
    [handlePrefillInput, openRetrievalSettings, router, t],
  );

  useEffect(() => {
    const unsubscribe = globalEventBus.on("chat:send", (prompt: string) => {
      setInputValue(prompt);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (focusMessageTimerRef.current != null) {
        globalThis.window.clearTimeout(focusMessageTimerRef.current);
      }
    };
  }, []);

  const effectiveChatRagConfig = useMemo(() => {
    const baseConfig =
      ragConfigDirty || hasSystemRagDefaults
        ? ragConfig
        : {
            enable_multi_query: ragConfig.enable_multi_query,
            enable_hyde: ragConfig.enable_hyde,
          };

    if (!deepReasoningEnabled) return baseConfig;

    const topK = Number.isFinite(ragConfig.top_k) ? ragConfig.top_k : 5;
    return {
      ...baseConfig,
      top_k: Math.max(topK, 8),
      retrieval_mode: "hybrid",
      enable_multi_query: true,
      multi_query_count: 3,
      enable_hyde: true,
    };
  }, [deepReasoningEnabled, hasSystemRagDefaults, ragConfig, ragConfigDirty]);

  const {
    messages,
    isLoading,
    currentResponse,
    currentCitations,
    currentSteps,
    sendMessage,
    stopGeneration,
    conversationId,
    loadConversation,
    resetConversation,
  } = useChat({
    conversationId: initialConversationId,
    documentIds: activeDocumentIds,
    datasetId: activeDocumentIds?.length
      ? undefined
      : selectedDatasetId || undefined,
    promptTemplateId: promptTemplateId || undefined,
    ragConfig: effectiveChatRagConfig,
    structuredOutput,
    structuredPreset: structuredPreset || undefined,
    enableLongTermMemory,
    enableSummaryMemory,
    onConversationId: publishConversation,
    onError: (error) => {
      reportClientError("Chat request failed", error);
      toast.error(error || t("requestFailed"));
    },
  });

  useEffect(() => {
    const unsubscribe = globalEventBus.on(
      "chat:focus-message",
      ({ messageId }) => {
        const id = String(messageId || "").trim();
        if (!id) return;

        if (messages.some((message) => message.id === id)) {
          setVisibleCount((current) => Math.max(current, messages.length));
        }

        globalThis.window.requestAnimationFrame(() => {
          if (focusMessageById(id)) return;
          globalThis.window.setTimeout(() => {
            focusMessageById(id);
          }, 80);
        });
      },
    );

    return () => unsubscribe();
  }, [focusMessageById, messages]);

  // A stream writes its new ID back to the URL. External navigation and reloads
  // load history; that one reflected update must leave the active stream alone.
  const followConversationRoute = useEffectEvent((id: string) => {
    const reflected = reflectedConversation.current;
    reflectedConversation.current = null;
    if (id) {
      if (id !== reflected) {
        void loadConversation(id).catch((error) => reportClientError("Failed to load conversation", error));
      }
    } else if (conversationId || isLoading) {
      resetConversation();
    }
  });

  useEffect(() => {
    followConversationRoute((initialConversationId ?? "").trim());
  }, [initialConversationId]);

  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE_MESSAGES);
  }, [conversationId]);

  const updateAutoScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceToBottom < 160;
    autoScrollRef.current = nearBottom;
    setIsNearBottom((prev) => (prev === nearBottom ? prev : nearBottom));
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollEventRafRef.current != null) return;
    scrollEventRafRef.current = globalThis.window.requestAnimationFrame(() => {
      scrollEventRafRef.current = null;
      updateAutoScroll();
    });
  }, [updateAutoScroll]);

  const scheduleScrollToBottom = useCallback((behavior: ScrollBehavior) => {
    if (!autoScrollRef.current) return;
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = globalThis.window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  const jumpToBottom = useCallback(() => {
    autoScrollRef.current = true;
    setIsNearBottom(true);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleLoadMore = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      pendingPrependScrollRef.current = {
        top: el.scrollTop,
        height: el.scrollHeight,
      };
    }
    setVisibleCount((count) =>
      Math.min(messages.length, count + LOAD_MORE_STEP),
    );
  }, [messages.length]);

  // Preserve scroll position when revealing older messages.
  useLayoutEffect(() => {
    const pending = pendingPrependScrollRef.current;
    if (!pending) return;
    const el = scrollContainerRef.current;
    if (!el) {
      pendingPrependScrollRef.current = null;
      return;
    }
    const delta = el.scrollHeight - pending.height;
    el.scrollTop = pending.top + delta;
    pendingPrependScrollRef.current = null;
    updateAutoScroll();
  }, [visibleCount, updateAutoScroll]);

  useEffect(() => {
    if (messages.length === 0) return;
    scheduleScrollToBottom("smooth");
  }, [messages.length, scheduleScrollToBottom]);

  useEffect(() => {
    if (!currentResponse) return;
    scheduleScrollToBottom("auto");
  }, [currentResponse, scheduleScrollToBottom]);

  useEffect(() => {
    updateAutoScroll();
    return () => {
      if (scrollRafRef.current != null) {
        globalThis.window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      if (scrollEventRafRef.current != null) {
        globalThis.window.cancelAnimationFrame(scrollEventRafRef.current);
        scrollEventRafRef.current = null;
      }
    };
  }, [updateAutoScroll]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    const p = (initialPrompt || "").trim();
    if (!p) return;
    setInputValue((prev) => (prev.trim() ? prev : p));
  }, [initialPrompt]);

  useEffect(() => {
    if (!initialOpenRagSettings || initialRagSettingsHandledRef.current) return;
    initialRagSettingsHandledRef.current = true;
    openRetrievalSettings();
  }, [initialOpenRagSettings, openRetrievalSettings]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const media = globalThis.window.matchMedia("(min-width: 1024px)");
    const handleChange = () => {
      if (media.matches) setSettingsSheetOpen(false);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const selectedPromptTemplate = useMemo(
    () => promptTemplates.find((template) => template.id === promptTemplateId),
    [promptTemplates, promptTemplateId],
  );
  const hasDocumentScope = Boolean(activeDocumentIds?.length);
  const hasChatScope = hasDocumentScope || Boolean(selectedDatasetId);
  const datasetScopeReady = hasDocumentScope || !datasetsLoading;
  const scopeLabel = hasDocumentScope
    ? t("currentDocumentScope")
    : selectedDataset?.name ||
      (datasetsLoading ? t("datasetScopeLoading") : t("selectDataset"));

  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const visibleMessages = useMemo(
    () => messages.slice(-visibleCount),
    [messages, visibleCount],
  );

  const submitMessage = useCallback(
    (nextMessage: string) => {
      if (!nextMessage.trim() || isLoading) return false;
      if (!hasChatScope) {
        toast.error(
          datasetsLoading
            ? t("datasetScopeLoading")
            : t("datasetScopeRequired"),
        );
        return false;
      }
      sendMessage(nextMessage);
      return true;
    },
    [datasetsLoading, hasChatScope, isLoading, sendMessage, t],
  );

  const handleSend = useCallback(() => {
    if (!submitMessage(inputValue)) return;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [inputValue, submitMessage]);

  useEffect(() => {
    const unsubscribe = globalEventBus.on("chat:submit", (payload: string) => {
      const prompt = payload.trim();
      if (!prompt) return;
      if (submitMessage(prompt)) {
        setInputValue("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        return;
      }
      setInputValue(prompt);
    });

    return () => unsubscribe();
  }, [submitMessage]);

  useEffect(() => {
    const p = (initialPrompt || "").trim();
    if (!initialAutoSendPrompt || !p) return;
    if (autoSendPromptRef.current) return;
    if (isLoading) return;
    if (!datasetScopeReady || !hasChatScope) return;

    if (!submitMessage(p)) return;
    autoSendPromptRef.current = true;
    setInputValue("");
    onPromptConsumed?.();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [
    datasetScopeReady,
    hasChatScope,
    initialAutoSendPrompt,
    initialPrompt,
    isLoading,
    onPromptConsumed,
    submitMessage,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isWelcomeState = messages.length === 0 && !isLoading;
  const panelProps = {
    datasets,
    datasetsLoading,
    datasetsError: datasetsQuery.isError,
    onRetryDatasets: () => {
      void datasetsQuery.refetch();
    },
    selectedDatasetId,
    onSelectDataset: setSelectedDatasetId,
    documentScopeActive: hasDocumentScope,
    promptTemplates,
    promptTemplateId,
    onSelectPromptTemplate: setPromptTemplateId,
    config: ragConfig,
    onConfigChange: updateRagConfig,
    metadataFilterMode,
    metadataFilterText,
    metadataFilterError,
    onMetadataFilterModeChange: applyMetadataFilterPreset,
    onMetadataFilterTextChange: setMetadataFilterText,
    deepReasoningEnabled,
    onDeepReasoningChange: setDeepReasoningEnabled,
    structuredOutput,
    onStructuredOutputChange: setStructuredOutput,
    structuredPreset,
    onStructuredPresetChange: setStructuredPreset,
    enableLongTermMemory,
    onEnableLongTermMemoryChange: setEnableLongTermMemory,
    enableSummaryMemory,
    onEnableSummaryMemoryChange: setEnableSummaryMemory,
    conversationId,
    onOpenSummary: () => {
      setSettingsSheetOpen(false);
      setSummaryDialogOpen(true);
    },
    onOpenTrace: () => {
      setSettingsSheetOpen(false);
      setTraceDialogOpen(true);
    },
    onOpenVoice: () => {
      setSettingsSheetOpen(false);
      setVoiceModeOpen(true);
    },
    rerank: rerankStatus,
    settingsError: settingsQuery.isError,
    onRetrySettings: () => {
      void settingsQuery.refetch();
    },
  } as const;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background">
      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 gap-5 px-4 md:px-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overscroll-contain scroll-smooth no-scrollbar"
            role="log"
            aria-live="polite"
            aria-busy={isLoading}
          >
            <div
              className={cn(
                "mx-auto flex min-h-full w-full max-w-[720px] flex-col",
                isWelcomeState ? "justify-center" : "py-8",
              )}
            >
              {isWelcomeState ? <WelcomeScreen /> : null}

              {hiddenCount > 0 ? (
                <div className="flex justify-center py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="text-caption text-muted-foreground"
                  >
                    {t("showEarlierMessages")}（{hiddenCount}）
                  </Button>
                </div>
              ) : null}

              {!isWelcomeState ? (
                <div>
                  {visibleMessages.map((message) => (
                    <div
                      key={message.id}
                      data-chat-message-id={message.id}
                      tabIndex={-1}
                      className={cn(
                        "outline-none",
                        focusedMessageId === message.id &&
                          "ring-1 ring-ring ring-offset-2 ring-offset-background",
                      )}
                    >
                      <ChatMessageItem message={message} />
                    </div>
                  ))}

                  {isLoading &&
                  (currentResponse ||
                    (currentSteps && currentSteps.length > 0)) ? (
                    <ChatMessageItem
                      message={{
                        id: "streaming",
                        role: "assistant",
                        content: currentResponse,
                        citations: currentCitations,
                        steps: currentSteps,
                        created_at: new Date().toISOString(),
                      }}
                      isStreaming
                    />
                  ) : null}
                </div>
              ) : null}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {!isNearBottom &&
          (messages.length > 0 || Boolean(currentResponse)) ? (
            <div className="pointer-events-none absolute bottom-28 right-4 z-20 md:right-6">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={jumpToBottom}
                className="pointer-events-auto bg-surface"
                aria-label={t("jumpToLatestMessage")}
                title={t("jumpToLatestMessage")}
              >
                <ArrowDown className="size-4" />
                {t("jumpToLatest")}
              </Button>
            </div>
          ) : null}

          <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
            <div className="mx-auto w-full max-w-[720px]">
              <div className="rounded-[4px] border border-border bg-surface focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                <Label htmlFor="chat-composer" className="sr-only">
                  {t("messageInput")}
                </Label>
                <textarea
                  id="chat-composer"
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  placeholder={t("composerPlaceholder")}
                  autoFocus
                  className="max-h-[200px] min-h-[72px] w-full resize-none bg-transparent px-3 py-2.5 text-body leading-[22px] text-foreground outline-none placeholder:text-muted-foreground no-scrollbar"
                  rows={1}
                />

                <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-2 py-1.5">
                  <Badge
                    variant={hasChatScope ? "outline" : "warning"}
                    className="max-w-[12rem] truncate"
                    title={scopeLabel}
                  >
                    {scopeLabel}
                  </Badge>

                  <span className="flex-1" />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={openRetrievalSettings}
                    aria-label={t("retrievalSettings")}
                    title={t("retrievalSettings")}
                  >
                    <Settings2 className="size-4" />
                  </Button>
                  {isLoading ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={stopGeneration}
                      aria-label={t("stopGeneration")}
                      title={t("stopGeneration")}
                    >
                      <StopCircle className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleSend}
                      disabled={!inputValue.trim() || !hasChatScope}
                      aria-label={t("send")}
                      title={
                        hasChatScope
                          ? t("send")
                          : datasetsLoading
                            ? t("datasetScopeLoading")
                            : t("datasetScopeRequired")
                      }
                    >
                      <Send className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              {isWelcomeState ? (
                <div className="mt-2 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openCommandMenu("/")}
                    className="text-micro text-muted-foreground"
                    title="工具 / 快捷指令"
                  >
                    <Wand2 className="size-3.5" />
                    工具
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-center text-micro text-muted-foreground">
                  {t.rich("composerHelpText", {
                    slash: renderComposerSlash,
                    enter: renderComposerEnter,
                    shiftEnter: renderComposerEnter,
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {!isDocumentViewerOpen ? (
          <aside
            ref={retrievalPanelRef}
            id="chat-retrieval-panel"
            tabIndex={-1}
            aria-label={t("retrievalSettings")}
            className="hidden w-[200px] shrink-0 overflow-y-auto py-6 outline-none lg:block"
          >
            <div className="rounded-[6px] border border-border p-3">
              <RetrievalSettingsPanel
                idPrefix="chat-retrieval-panel"
                {...panelProps}
              />
            </div>
          </aside>
        ) : null}
      </div>

      <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
        <SheetContent
          side="right"
          className="w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-4 shadow-none sm:max-w-sm"
        >
          <SheetHeader className="mb-3 pr-8">
            <SheetTitle className="text-compact">
              {t("retrievalSettings")}
            </SheetTitle>
            <SheetDescription className="text-micro">
              {t("adjustRetrievalParameters")}
            </SheetDescription>
          </SheetHeader>
          <RetrievalSettingsPanel
            idPrefix="chat-retrieval-sheet"
            {...panelProps}
          />
        </SheetContent>
      </Sheet>

      <SlashMenu
        open={slashOpen}
        onOpenChange={setSlashOpen}
        onSelect={handleSlashSelect}
        position={slashPos}
      />

      <VoiceModeOverlay
        isOpen={voiceModeOpen}
        onClose={() => setVoiceModeOpen(false)}
        onSend={(text) => {
          if (submitMessage(text)) {
            setVoiceModeOpen(false);
          }
        }}
      />

      <ConversationSummaryDialog
        open={summaryDialogOpen}
        onOpenChange={setSummaryDialogOpen}
        conversationId={conversationId}
      />
      <RagTraceDialog
        open={traceDialogOpen}
        onOpenChange={setTraceDialogOpen}
        conversationId={conversationId ?? null}
      />
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <svg
        viewBox="0 0 88 88"
        role="img"
        aria-label="MimirQ"
        className="size-16 select-none text-foreground sm:size-20"
      >
        <rect
          x="0.75"
          y="0.75"
          width="86.5"
          height="86.5"
          rx="6"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />
        <path
          d="M20 32 36 19h18"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 32v24"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M68 56 52 69H34"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M68 56V32"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M37 36h12l4 4v14H37z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M41 44h8M41 48h8M41 52h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
      </svg>
      <h1 className="mt-4 text-display font-semibold text-foreground">
        MimirQ
      </h1>
      <p className="mt-2 text-body text-muted-foreground">
        可检查、可替换、可回归的企业 RAG 基础设施
      </p>
      <div className="mt-8 h-px w-24 bg-border" aria-hidden="true" />
      <p className="mt-4 max-w-md text-caption leading-5 text-subtle-foreground">
        在下方确认检索范围，输入问题开始；回答中的引用可以展开核对原文。
      </p>
    </div>
  );
}
