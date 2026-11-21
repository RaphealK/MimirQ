'use client'

import {
  Download,
  FileCheck2,
  FileSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  UploadCloud,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageTitleIcon } from '@/components/ui/page-title-icon'
import { cn } from '@/lib/utils'
import { IngestionViewSwitch } from '@/app/knowledge/ingestion/view-switch'

type IngestionHeroPanelProps = {
  demoMode: boolean
  desktopScopeCollapsed: boolean
  headerBodyVisibilityClass: string
  ingestionRecommendationLabel: string
  mode: 'sales-audit' | 'execution-monitor'
  salesAuditComplexity: string
  salesAuditPocSampleLabel: string
  selectedDatasetLabel: string
  showDesktopScopeControl: boolean
  showSalesPolicyBadge: boolean
  summaryStripClassName: string
  taskQueueStatusLabel: string
  taskQueueStatusTone: string
  onDownloadReport: () => void
  onExitDemoMode: () => void
  onExportSalesAuditReport: () => void
  onToggleDesktopScope: () => void
  onUploadFormalIngest: () => void
  onUploadSampleAssessment: () => void
}

type SummaryStripItem = {
  detail: string
  icon: LucideIcon
  label: string
  tone: string
  value: string
}

export function IngestionHeroPanel({
  demoMode,
  desktopScopeCollapsed,
  headerBodyVisibilityClass,
  ingestionRecommendationLabel,
  mode,
  onDownloadReport,
  onExitDemoMode,
  onExportSalesAuditReport,
  onToggleDesktopScope,
  onUploadFormalIngest,
  onUploadSampleAssessment,
  salesAuditComplexity,
  salesAuditPocSampleLabel,
  selectedDatasetLabel,
  showDesktopScopeControl,
  showSalesPolicyBadge,
  summaryStripClassName,
  taskQueueStatusLabel,
  taskQueueStatusTone,
}: Readonly<IngestionHeroPanelProps>) {
  const summaryStripItems: SummaryStripItem[] = [
    {
      label: '范围',
      value: selectedDatasetLabel,
      icon: FileSearch,
      tone: 'text-muted-foreground',
      detail: '',
    },
    {
      label: '入库建议',
      value: ingestionRecommendationLabel,
      icon: Workflow,
      tone: 'text-foreground',
      detail: '',
    },
    {
      label: '抽样确认量',
      value: salesAuditPocSampleLabel,
      icon: FileCheck2,
      tone: 'text-foreground',
      detail: '',
    },
    {
      label: '处理复杂度',
      value: salesAuditComplexity,
      icon: Radar,
      tone: 'text-warning',
      detail: '',
    },
  ]

  return (
    <div className="relative px-0.5 py-2">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {showSalesPolicyBadge ? (
              <span className="inline-flex items-center rounded-[4px] border border-border bg-muted px-2 py-0.5 text-micro font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Sensitive Data Policy
              </span>
            ) : null}
            {demoMode ? (
              <span className="inline-flex items-center rounded-[4px] border border-border bg-muted px-2 py-0.5 text-micro font-medium uppercase tracking-[0.16em] text-foreground">
                演示模式
              </span>
            ) : null}
          </div>
          <div
            className={cn(
              'overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out',
              headerBodyVisibilityClass
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[4px] bg-muted text-foreground">
                <PageTitleIcon name="ingestion-monitor" className="size-8" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="shrink-0 whitespace-nowrap text-title font-semibold leading-6 tracking-[-0.025em] text-foreground">
                    {mode === 'sales-audit' ? '入库预检工作台' : '执行监控'}
                  </h1>
                  {mode === 'execution-monitor' ? (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-micro font-medium',
                        taskQueueStatusTone
                      )}
                    >
                      {taskQueueStatusLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 max-w-[52rem] text-caption leading-4 text-muted-foreground">
                  {mode === 'sales-audit'
                    ? '选择目标数据集后先做入库预检，确认目录、策略、重复与风险，再把文件写入知识库；入库完成后可切换执行监控查看队列和失败重试。'
                    : '集中观察处理模式、吞吐、失败重试与运行态列表，快速判断入库链路是否健康。'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {mode === 'execution-monitor' && showDesktopScopeControl ? (
            <Button
              data-monitor-scope-control="true"
              type="button"
              variant="outline"
              aria-pressed={!desktopScopeCollapsed}
              className="h-8 rounded-[4px] border-border bg-surface px-2.5 text-micro font-medium text-muted-foreground hover:border-border-strong hover:bg-muted hover:text-foreground"
              onClick={onToggleDesktopScope}
            >
              {desktopScopeCollapsed ? (
                <PanelLeftOpen className="mr-1.5 size-3.5" />
              ) : (
                <PanelLeftClose className="mr-1.5 size-3.5" />
              )}
              范围
            </Button>
          ) : null}
          <IngestionViewSwitch compact tone="info" />
          {demoMode ? (
            <Button
              type="button"
              variant="outline"
              className="h-7 rounded-[4px] px-2 text-micro"
              onClick={onExitDemoMode}
            >
              退出演示
            </Button>
          ) : null}
          {mode === 'sales-audit' ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-7 rounded-[4px] px-2 text-micro"
                onClick={onUploadSampleAssessment}
              >
                <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                上传预检文件
              </Button>
              <Button
                type="button"
                className="h-7 rounded-[4px] px-2 text-micro"
                onClick={onUploadFormalIngest}
              >
                <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                正式入库
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-7 rounded-[4px] px-2 text-micro"
                onClick={onExportSalesAuditReport}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                入库预检报告
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-[4px] border border-border bg-muted px-2.5 text-micro text-foreground transition-colors hover:bg-raised hover:text-foreground"
              onClick={onDownloadReport}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              导出报告
            </Button>
          )}
        </div>
      </div>

      {mode === 'sales-audit' ? (
        <div className={cn('mt-2.5', summaryStripClassName)}>
          <div className="grid gap-px sm:grid-cols-4">
            {summaryStripItems.map(({ detail, icon: Icon, label, tone, value }) => (
              <div
                key={label}
                className="relative min-h-[3.4rem] bg-surface px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-micro font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                  </div>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-muted/30">
                    <Icon className={cn('h-2.5 w-2.5 shrink-0', tone)} />
                  </span>
                </div>
                <div className="mt-1 font-mono text-micro tabular-nums leading-none text-foreground">
                  {value}
                </div>
                {detail ? (
                  <div className="mt-1 text-micro text-muted-foreground">
                    {detail}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
