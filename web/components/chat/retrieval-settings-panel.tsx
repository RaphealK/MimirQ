/**
 * Retrieval settings panel shared by the desktop rail and the mobile sheet.
 *
 * Every field maps to real chat/settings state. There is no fabricated
 * recall/rerank control: rerank is displayed from the settings snapshot only.
 */
"use client";

import { AlertTriangle, Route } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dataset } from "@/types";
import type { PromptTemplate } from "@/lib/api/prompts";
import { cn } from "@/lib/utils";

export const PROMPT_TEMPLATE_DEFAULT_VALUE = "__mimirq_default__";

export type ChatRetrievalConfig = {
  top_k: number;
  score_threshold: number;
  retrieval_mode: string;
  use_graph: boolean;
  enable_multi_query: boolean;
  enable_hyde: boolean;
  metadata_filter?: Record<string, unknown> | null;
};

export type MetadataFilterMode = "all" | "exclude_qa" | "qa_only" | "custom";

export type RetrievalRerankStatus = Readonly<{
  enabled: boolean;
  provider?: string | null;
  topN?: number | null;
  weightRerank?: boolean;
}>;

type RetrievalSettingsPanelProps = Readonly<{
  idPrefix: string;
  datasets: Dataset[];
  datasetsLoading: boolean;
  datasetsError: boolean;
  onRetryDatasets: () => void;
  selectedDatasetId: string;
  onSelectDataset: (datasetId: string) => void;
  documentScopeActive: boolean;
  promptTemplates: PromptTemplate[];
  promptTemplateId: string;
  onSelectPromptTemplate: (templateId: string) => void;
  config: ChatRetrievalConfig;
  onConfigChange: (patch: Partial<ChatRetrievalConfig>) => void;
  metadataFilterMode: MetadataFilterMode;
  metadataFilterText: string;
  metadataFilterError: string | null;
  onMetadataFilterModeChange: (mode: MetadataFilterMode) => void;
  onMetadataFilterTextChange: (text: string) => void;
  deepReasoningEnabled: boolean;
  onDeepReasoningChange: (enabled: boolean) => void;
  structuredOutput: boolean;
  onStructuredOutputChange: (enabled: boolean) => void;
  structuredPreset: string;
  onStructuredPresetChange: (preset: string) => void;
  enableLongTermMemory: boolean;
  onEnableLongTermMemoryChange: (enabled: boolean) => void;
  enableSummaryMemory: boolean;
  onEnableSummaryMemoryChange: (enabled: boolean) => void;
  conversationId?: string | null;
  onOpenSummary: () => void;
  onOpenTrace: () => void;
  onOpenVoice: () => void;
  rerank: RetrievalRerankStatus | null;
  settingsError: boolean;
  onRetrySettings: () => void;
}>;

function Field({
  id,
  label,
  children,
}: Readonly<{ id: string; label: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-micro text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  action,
}: Readonly<{
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  action?: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 sm:min-h-8">
      <div className="min-w-0">
        <p className="text-caption text-foreground">{label}</p>
        {description ? (
          <p className="text-micro leading-4 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {action}
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function RetrievalSettingsPanel({
  idPrefix,
  datasets,
  datasetsLoading,
  datasetsError,
  onRetryDatasets,
  selectedDatasetId,
  onSelectDataset,
  documentScopeActive,
  promptTemplates,
  promptTemplateId,
  onSelectPromptTemplate,
  config,
  onConfigChange,
  metadataFilterMode,
  metadataFilterText,
  metadataFilterError,
  onMetadataFilterModeChange,
  onMetadataFilterTextChange,
  deepReasoningEnabled,
  onDeepReasoningChange,
  structuredOutput,
  onStructuredOutputChange,
  structuredPreset,
  onStructuredPresetChange,
  enableLongTermMemory,
  onEnableLongTermMemoryChange,
  enableSummaryMemory,
  onEnableSummaryMemoryChange,
  conversationId,
  onOpenSummary,
  onOpenTrace,
  onOpenVoice,
  rerank,
  settingsError,
  onRetrySettings,
}: Readonly<RetrievalSettingsPanelProps>) {
  const t = useTranslations("Chat");
  const datasetFieldId = `${idPrefix}-dataset`;
  const topKId = `${idPrefix}-top-k`;
  const thresholdId = `${idPrefix}-score-threshold`;
  const presetId = `${idPrefix}-structured-preset`;
  const templateId = `${idPrefix}-prompt-template`;
  const metadataId = `${idPrefix}-metadata-filter`;
  const metadataJsonId = `${idPrefix}-metadata-json`;

  return (
    <div className="space-y-3" data-chat-retrieval-settings={idPrefix}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-micro font-medium uppercase text-muted-foreground">
          {t("retrievalSettings")}
        </h3>
      </div>

      {datasetsError || settingsError ? (
        <div className="rounded-[4px] border border-warning/30 bg-warning/10 p-2 text-micro text-warning">
          <div className="flex items-start gap-1.5">
            <AlertTriangle
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p>
                {datasetsError
                  ? "数据集列表加载失败。"
                  : "系统检索默认值加载失败。"}
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={datasetsError ? onRetryDatasets : onRetrySettings}
                className="h-auto min-h-11 justify-start px-0 text-micro text-warning sm:min-h-7"
              >
                重试
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-micro text-muted-foreground">{t("selectDataset")}</p>
        {documentScopeActive ? (
          <div className="flex min-h-11 items-center rounded-[4px] border border-border bg-muted/40 px-2.5 text-caption text-foreground sm:min-h-8">
            {t("currentDocumentScope")}
          </div>
        ) : (
          <Select
            value={selectedDatasetId || undefined}
            onValueChange={onSelectDataset}
            disabled={datasetsLoading || datasets.length === 0}
          >
            <SelectTrigger
              id={datasetFieldId}
              className="text-caption"
              aria-label={t("selectDataset")}
            >
              <SelectValue
                placeholder={
                  datasetsLoading
                    ? t("datasetScopeLoading")
                    : t("selectDataset")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {datasets.map((dataset) => (
                <SelectItem key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {documentScopeActive ? (
          <p className="text-micro leading-4 text-muted-foreground">
            {t("datasetScopeHint")}
          </p>
        ) : !datasetsLoading && datasets.length === 0 ? (
          <p className="text-micro leading-4 text-muted-foreground">
            {t("datasetScopeEmpty")}
          </p>
        ) : !selectedDatasetId ? (
          <p className="text-micro leading-4 text-warning">
            {t("datasetScopeRequired")}
          </p>
        ) : null}
      </div>

      <Field id={`${idPrefix}-retrieval-mode`} label={t("retrievalMode")}>
        <Select
          value={config.retrieval_mode}
          onValueChange={(value) => onConfigChange({ retrieval_mode: value })}
        >
          <SelectTrigger
            id={`${idPrefix}-retrieval-mode`}
            className="text-caption"
            aria-label={t("retrievalMode")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t("retrievalModes.auto")}</SelectItem>
            <SelectItem value="hybrid">{t("retrievalModes.hybrid")}</SelectItem>
            <SelectItem value="vector">{t("retrievalModes.vector")}</SelectItem>
            <SelectItem value="keyword">
              {t("retrievalModes.keyword")}
            </SelectItem>
            <SelectItem value="mmr">{t("retrievalModes.mmr")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field id={topKId} label={t("topK")}>
          <Input
            id={topKId}
            type="number"
            min={1}
            max={50}
            value={config.top_k}
            onChange={(event) =>
              onConfigChange({ top_k: Number(event.target.value || 0) })
            }
            className="text-caption tabular-nums"
          />
        </Field>
        <Field id={thresholdId} label="分数阈值">
          <Input
            id={thresholdId}
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={config.score_threshold}
            onChange={(event) =>
              onConfigChange({
                score_threshold: Number(event.target.value || 0),
              })
            }
            className="text-caption tabular-nums"
          />
        </Field>
      </div>

      {rerank ? (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-micro">
          <span className="text-muted-foreground">重排</span>
          <span className="text-right text-foreground">
            {rerank.enabled
              ? [
                  "开启",
                  rerank.provider,
                  rerank.topN ? `Top ${rerank.topN}` : null,
                  rerank.weightRerank ? "加权" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "关闭"}
          </span>
        </div>
      ) : null}

      <details className="border-t border-border pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-micro text-muted-foreground [&::-webkit-details-marker]:hidden sm:min-h-8">
          <span>高级设置</span>
          <span>记忆 · 模板 · 追踪</span>
        </summary>
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            <ToggleRow
              label={t("useKnowledgeGraph")}
              checked={config.use_graph}
              onCheckedChange={(checked) =>
                onConfigChange({ use_graph: checked })
              }
            />
            <ToggleRow
              label={t("enableLongTermMemory")}
              checked={enableLongTermMemory}
              onCheckedChange={onEnableLongTermMemoryChange}
            />
            <ToggleRow
              label={t("enableSummaryMemory")}
              checked={enableSummaryMemory}
              onCheckedChange={onEnableSummaryMemoryChange}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenSummary}
                  disabled={!conversationId}
                  title={
                    conversationId
                      ? t("viewOrUpdateSummary")
                      : t("sendMessageFirst")
                  }
                  className="min-h-11 px-2 text-micro sm:min-h-7"
                >
                  {t("viewSummary")}
                </Button>
              }
            />
            <ToggleRow
              label="深度思考"
              description="提高召回强度：多查询、HyDE、更高 Top K"
              checked={deepReasoningEnabled}
              onCheckedChange={onDeepReasoningChange}
            />
            <ToggleRow
              label={t("structuredOutput")}
              checked={structuredOutput}
              onCheckedChange={onStructuredOutputChange}
            />
            {structuredOutput ? (
              <div className="pl-1">
                <Select
                  value={structuredPreset || PROMPT_TEMPLATE_DEFAULT_VALUE}
                  onValueChange={(value) =>
                    onStructuredPresetChange(
                      value === PROMPT_TEMPLATE_DEFAULT_VALUE ? "" : value,
                    )
                  }
                >
                  <SelectTrigger
                    id={presetId}
                    className="text-caption"
                    aria-label={t("structuredPresetPlaceholder")}
                  >
                    <SelectValue
                      placeholder={t("structuredPresetPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROMPT_TEMPLATE_DEFAULT_VALUE}>
                      {t("structuredPresetCustom")}
                    </SelectItem>
                    <SelectItem value="faq">
                      {t("structuredPresetFaq")}
                    </SelectItem>
                    <SelectItem value="summary">
                      {t("structuredPresetSummary")}
                    </SelectItem>
                    <SelectItem value="action_items">
                      {t("structuredPresetActionItems")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {promptTemplates.length > 0 ? (
            <Field id={templateId} label={t("selectPromptTemplate")}>
              <Select
                value={promptTemplateId || PROMPT_TEMPLATE_DEFAULT_VALUE}
                onValueChange={(value) =>
                  onSelectPromptTemplate(
                    value === PROMPT_TEMPLATE_DEFAULT_VALUE ? "" : value,
                  )
                }
              >
                <SelectTrigger
                  id={templateId}
                  className="text-caption"
                  aria-label={t("selectPromptTemplate")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROMPT_TEMPLATE_DEFAULT_VALUE}>
                    {t("defaultTemplate")}
                  </SelectItem>
                  {promptTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <details className="border-t border-border pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-micro text-muted-foreground [&::-webkit-details-marker]:hidden sm:min-h-8">
              <span>{t("metadataFilter")}</span>
              <span>{metadataFilterMode === "all" ? "全部" : "已设置"}</span>
            </summary>
            <div className="mt-2 space-y-2">
              <Select
                value={metadataFilterMode}
                onValueChange={(value) =>
                  onMetadataFilterModeChange(
                    (
                      ["all", "exclude_qa", "qa_only", "custom"] as const
                    ).includes(value as MetadataFilterMode)
                      ? (value as MetadataFilterMode)
                      : "all",
                  )
                }
              >
                <SelectTrigger
                  id={metadataId}
                  className="text-caption"
                  aria-label={t("metadataFilter")}
                >
                  <SelectValue placeholder={t("metadataFilterPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("metadataFilters.allChunks")}
                  </SelectItem>
                  <SelectItem value="exclude_qa">
                    {t("metadataFilters.excludeQa")}
                  </SelectItem>
                  <SelectItem value="qa_only">
                    {t("metadataFilters.qaOnly")}
                  </SelectItem>
                  <SelectItem value="custom">
                    {t("metadataFilters.customJson")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {metadataFilterMode === "custom" ? (
                <div className="space-y-1">
                  <Label
                    htmlFor={metadataJsonId}
                    className="text-micro text-muted-foreground"
                  >
                    JSON
                  </Label>
                  <Textarea
                    id={metadataJsonId}
                    value={metadataFilterText}
                    onChange={(event) =>
                      onMetadataFilterTextChange(event.target.value)
                    }
                    placeholder={t("metadataFilterExampleHandbook")}
                    className="min-h-[92px] font-mono text-micro"
                  />
                  {metadataFilterError ? (
                    <p className="text-micro text-destructive">
                      {metadataFilterError}
                    </p>
                  ) : null}
                  <details className="rounded-[4px] border border-border bg-muted/30 px-2 py-1.5">
                    <summary className="cursor-pointer list-none text-micro text-muted-foreground [&::-webkit-details-marker]:hidden">
                      {t("supportedOperatorsExamples")}
                    </summary>
                    <div className="mt-1.5 space-y-1 text-micro text-muted-foreground">
                      <p className="font-mono text-foreground">
                        {t("supportedOperatorsList")}
                      </p>
                      <p>{t("supportedOperatorsHint")}</p>
                      <p className="font-mono text-foreground">
                        {t("metadataFilterExampleQa")}
                      </p>
                      <p className="font-mono text-foreground">
                        {t("metadataFilterExampleHandbook")}
                      </p>
                    </div>
                  </details>
                </div>
              ) : null}
            </div>
          </details>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-micro">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Route className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t("ragTraceEntry")}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenTrace}
              disabled={!conversationId}
              title={conversationId ? t("viewRagTrace") : t("sendMessageFirst")}
              className="min-h-11 px-2 text-micro sm:min-h-7"
            >
              {t("viewTrace")}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-micro">
            <span className="text-muted-foreground">{t("voiceMode")}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenVoice}
              className="min-h-11 px-2 text-micro sm:min-h-7"
            >
              {t("voiceMode")}
            </Button>
          </div>
        </div>
      </details>

      <p className={cn("text-micro leading-4 text-muted-foreground")}>
        改动只作用于下一轮提问。
      </p>
    </div>
  );
}
