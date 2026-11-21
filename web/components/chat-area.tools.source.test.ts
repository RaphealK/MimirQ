// Source contract check only; interactive behavior is covered by browser verification.
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
}

describe("chat engineering layout source", () => {
  const chatArea = read("chat-area.tsx");
  const messageItem = read("chat/message-item.tsx");
  const retrievalPanel = read("chat/retrieval-settings-panel.tsx");
  const zhChat = read("../i18n/messages/zh-CN/chat.ts");

  it("keeps one shared retrieval form for the wide rail and the narrow sheet", () => {
    expect(chatArea).toContain("max-w-[720px]");
    expect(chatArea).toContain('id="chat-retrieval-panel"');
    expect(chatArea).toContain("w-[200px]");
    expect(chatArea).toContain('idPrefix="chat-retrieval-sheet"');
    expect(chatArea).toContain("SheetContent");
    expect(chatArea).toContain("openRetrievalSettings");
    expect(chatArea).toContain("initialOpenRagSettings");
    expect(chatArea).toContain('idPrefix="chat-retrieval-panel"');
    expect(chatArea).toContain('idPrefix="chat-retrieval-sheet"');
    expect(chatArea).toContain("{...panelProps}");

    // The form itself is shared; the two mount points only differ by id prefix.
    expect(retrievalPanel).toContain("export function RetrievalSettingsPanel");
    expect(retrievalPanel).toContain("top_k");
    expect(retrievalPanel).toContain("score_threshold");
    expect(retrievalPanel).toContain("retrieval_mode");
    expect(retrievalPanel).toContain("use_graph");
    expect(retrievalPanel).toContain("metadata_filter");
    expect(retrievalPanel).toContain("改动只作用于下一轮提问。");
  });

  it("shows only real settings and real rerank status", () => {
    // Request fields stay the existing chat/settings contract.
    expect(chatArea).toContain("top_k");
    expect(chatArea).toContain("score_threshold");
    expect(chatArea).toContain("retrieval_mode");
    expect(chatArea).toContain("use_graph");
    expect(chatArea).toContain("enableLongTermMemory");
    expect(chatArea).toContain("enableSummaryMemory");
    expect(chatArea).toContain("structuredOutput");
    expect(chatArea).toContain("enable_reranker");
    expect(chatArea).toContain("reranker_provider");
    expect(chatArea).toContain("reranker_top_n");
    expect(chatArea).toContain("settingsQuery.data?.rag");

    // No invented recall/rerank controls or fake sample values.
    expect(chatArea).not.toContain("召回 12");
    expect(chatArea).not.toContain("取前 5");
    expect(chatArea).not.toContain("rerank: true");
    expect(retrievalPanel).not.toContain("召回 12");
    expect(retrievalPanel).not.toContain("取前 5");
  });

  it("renders a flat speaker-column message with citations attached to the answer", () => {
    expect(messageItem).toContain(
      'data-chat-message-layout={isMinimal ? undefined : "flat"}',
    );
    expect(messageItem).toContain("data-chat-speaker");
    expect(messageItem).toContain("w-11 shrink-0");
    expect(messageItem).toContain("按相关度排序");
    expect(messageItem).toContain("citation.document_name");
    expect(messageItem).toContain("citation.page_number");
    expect(messageItem).toContain("citation.relevance_score");
    expect(messageItem).toContain("formatCitationScore");
    expect(messageItem).toContain("formatCitationRankScore");
    expect(messageItem).toContain("原文");
    expect(messageItem).toContain("收起原文");
    expect(messageItem).toContain("展开其余");

    // No entrance animation, typewriter, magnetic hover or nested bubbles.
    expect(messageItem).not.toContain("CinematicTypewriter");
    expect(messageItem).not.toContain("from 'framer-motion'");
    expect(chatArea).not.toContain("Magnetic");
    expect(chatArea).not.toContain("CinematicTypewriter");
  });

  it("preserves real actions, document viewing and feedback callbacks", () => {
    expect(messageItem).toContain("openDocument");
    expect(messageItem).toContain("prefetchDocumentView");
    expect(messageItem).toContain("EvidenceViewerDialog");
    expect(messageItem).toContain("feedbackApi.create");
    expect(messageItem).toContain("handleCopy");
    expect(messageItem).toContain("检索诊断");
    expect(messageItem).not.toContain("重新生成");

    expect(chatArea).toContain("stopGeneration");
    expect(chatArea).toContain("VoiceModeOverlay");
    expect(chatArea).toContain("SlashMenu");
    expect(chatArea).toContain("ConversationSummaryDialog");
    expect(chatArea).toContain("RagTraceDialog");

    // The old duplicate theme customizer is collapsed into the sidebar ModeToggle.
    expect(chatArea).not.toContain("ThemeCustomizer");
    expect(chatArea).not.toContain("RAG 检索");
  });

  it("uses the existing chat translation keys for the shared form", () => {
    expect(zhChat).toContain("retrievalSettings: '检索设置'");
    expect(zhChat).toContain("topK: 'Top K'");
    expect(zhChat).toContain("metadataFilter: 'Metadata filter'");
    expect(retrievalPanel).toContain('t("retrievalSettings")');
    expect(retrievalPanel).toContain('t("topK")');
    expect(retrievalPanel).toContain('t("metadataFilter")');
  });
});
