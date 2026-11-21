'use client'

import type { EChartsOption } from 'echarts'
import {
  CircleAlert,
  CircleDashed,
  FileCheck2,
  FileDigit,
  FileSearch,
  Radar,
  ShieldAlert,
  Workflow,
} from 'lucide-react'

import { EChart } from '@/components/ui/echart'
import { TableScrollArea } from '@/components/ui/table-scroll-area'
import { SalesPanelHeader } from '@/app/knowledge/ingestion/components/sales-panel-header'
import { cn } from '@/lib/utils'
import {
  SALES_PANEL_CLASS,
  SALES_PANEL_INSET_CLASS,
  getDriverDotTone,
  getSalesCoreIcon,
  getSalesCoreIconTone,
  type SalesEvidenceTableRow,
  type SalesProcessingLane,
} from '@/app/knowledge/ingestion/presentation'

type CostDriver = {
  key: string
  label: string
  count: number
}

type SalesHeatmapItem = {
  name: string
  count: number
}

type LengthPercentiles = {
  p50: number
  p90: number
  p99: number
}

type SalesAuditSummaryPanelProps = {
  batchProfileBarOption: EChartsOption
  complexity: string
  coreSummary: Array<readonly [string, string, string]>
  costDrivers: CostDriver[]
  heatmapData: SalesHeatmapItem[]
  highRiskFiles: SalesEvidenceTableRow[]
  imageProxyNote: string
  lengthOption: EChartsOption
  lengthPercentiles: LengthPercentiles | null
  pdfSplitOption: EChartsOption
  pocCandidates: SalesEvidenceTableRow[]
  pricingMode: string
  processingLanes: SalesProcessingLane[]
  radarOption: EChartsOption
  samplePoolLabel: string
  sampleTarget: number | null
  sampleTargetDetail: string
  sourceLabel: string
  totalFiles: number
  totalSizeLabel: string
  onClearSelectedReason: () => void
  onHeatmapSelect: (reason: string) => void
  onOpenEvidenceFile: (fileId: string) => void
}

export function SalesAuditSummaryPanel({
  batchProfileBarOption,
  complexity,
  coreSummary,
  costDrivers,
  heatmapData,
  highRiskFiles,
  imageProxyNote,
  lengthOption,
  lengthPercentiles,
  pdfSplitOption,
  pocCandidates,
  pricingMode,
  processingLanes,
  radarOption,
  samplePoolLabel,
  sampleTarget,
  sampleTargetDetail,
  sourceLabel,
  totalFiles,
  totalSizeLabel,
  onClearSelectedReason,
  onHeatmapSelect,
  onOpenEvidenceFile,
}: Readonly<SalesAuditSummaryPanelProps>) {
  return (
    <div
      title="入库依据"
      className={cn(
        'relative overflow-hidden rounded-[6px] border border-border bg-surface p-2.5  md:p-3'
      )}
    >
      <div className="relative z-10 space-y-2">
        <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
          <div className="grid gap-1.5 xl:grid-cols-[184px_minmax(0,1fr)] xl:items-stretch">
            <div className="rounded-[4px] border border-border bg-muted/30 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-micro font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  入库依据
                </div>
                <FileDigit className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="mt-1 text-micro font-medium text-foreground">
                核心摘要
              </div>
              <p className="mt-1 text-micro leading-3.5 text-muted-foreground">
                默认输出脱敏后的客观事实，用于解释入库策略、预检范围与人工阻断来源。
              </p>
              <div className="mt-1.5 inline-flex items-center rounded-full border border-border bg-surface px-1.5 py-0.5 text-micro font-medium text-muted-foreground">
                Evidence-first · De-identified
              </div>
            </div>

            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
              {coreSummary.map(([label, value, note], index) => {
                const Icon = getSalesCoreIcon(index)
                const iconTone = getSalesCoreIconTone(index)
                return (
                  <div
                    key={label}
                    className={cn(
                      SALES_PANEL_INSET_CLASS,
                      'px-1.5 py-1.5 '
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted/30">
                        <Icon className={cn('h-2.5 w-2.5', iconTone)} />
                      </div>
                      <div className="text-micro font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        {label}
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-micro font-medium leading-none text-foreground">
                      {value}
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 text-micro leading-3',
                        index === 2 ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {note}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <div className="grid gap-1.5 xl:grid-cols-[0.96fr_1.12fr_0.8fr]">
          <section className={cn(SALES_PANEL_CLASS, 'flex h-full flex-col p-2.5')}>
            <SalesPanelHeader title="PDF 类型分布" icon={CircleDashed} />
            <div className="mt-1 h-[9rem]">
              <EChart option={pdfSplitOption} />
            </div>
            <div className="mt-auto rounded-[4px] border border-warning/15 bg-warning/10 px-2 py-1 text-micro leading-3.5 text-warning">
              扫描型 PDF 需要先 OCR 处理，预计工期抬升较大。
            </div>
          </section>

          <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
            <SalesPanelHeader
              title="文档长度分布（按字符数）"
              icon={FileSearch}
            />
            <div className="mt-1.5 grid gap-2 xl:grid-cols-[1fr_148px]">
              <div className="h-[8rem]">
                <EChart option={lengthOption} />
              </div>
              <div className={cn(SALES_PANEL_INSET_CLASS, 'space-y-1 px-2 py-1.5')}>
                {[
                  ['P50（中位数）', lengthPercentiles?.p50 || 0],
                  ['P90', lengthPercentiles?.p90 || 0],
                  ['P99', lengthPercentiles?.p99 || 0],
                  ['最大值', lengthPercentiles?.p99 || 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-2 text-micro"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-micro text-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
            <SalesPanelHeader
              title="复杂度细节"
              icon={Radar}
              iconTone="text-foreground"
            />
            <div className="mt-1.5 space-y-1">
              {costDrivers.map((driver) => (
                <div
                  key={driver.key}
                  className={cn(
                    SALES_PANEL_INSET_CLASS,
                    'flex items-center justify-between gap-3 px-2 py-1 text-micro'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('h-2 w-2 rounded-full', getDriverDotTone(driver.key))}
                    />
                    <span className="text-foreground">{driver.label}</span>
                  </div>
                  <span className="font-mono text-micro text-foreground">
                    {driver.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 h-[7.25rem] overflow-visible">
              <EChart option={radarOption} />
            </div>
          </section>
        </div>

        <div className="grid gap-1.5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
            <SalesPanelHeader
              title="风险热区（按风险类型）"
              icon={ShieldAlert}
              iconTone="text-destructive"
              actionLabel="查看全部"
              onAction={onClearSelectedReason}
            />
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-5">
              {heatmapData.slice(0, 5).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onHeatmapSelect(item.name)}
                  className={cn(SALES_PANEL_INSET_CLASS, 'px-2 py-1.5 text-left min-h-11 pointer-coarse:min-w-11 pointer-fine:sm:min-h-0')}
                >
                  <div className="text-micro text-muted-foreground">{item.name}</div>
                  <div className="mt-1 font-mono text-caption font-medium text-foreground">
                    {item.count.toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-micro text-muted-foreground">
                    占比{' '}
                    {((item.count / Math.max(1, totalFiles || 1)) * 100).toFixed(1)}%
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
            <SalesPanelHeader
              title="处理清单（待处理文件数）"
              icon={Workflow}
              iconTone="text-foreground"
              actionLabel="查看全部"
              onAction={onClearSelectedReason}
            />
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-4">
              {processingLanes.map((lane) => (
                <div
                  key={lane.key}
                  className={cn('rounded-[4px] border px-2 py-1.5', lane.tone)}
                >
                  <div className="text-micro">{lane.label}</div>
                  <div className="mt-1 text-center font-mono text-body font-semibold">
                    {lane.count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-1.5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
            <SalesPanelHeader
              title="入库抽样确认（5 份）"
              icon={FileCheck2}
              iconTone="text-success"
              subtitle="按复杂度维度覆盖主风险项"
              actionLabel="查看全部"
            />
            <TableScrollArea
              label="入库抽样确认"
              surface="surface"
              className="mt-1.5 rounded-[4px] border border-border"
            >
              <table className="w-full min-w-[520px] text-left text-micro">
                <thead className="bg-muted/25 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 font-medium">文件名</th>
                    <th className="px-2 py-1 font-medium">类型</th>
                    <th className="px-2 py-1 text-right font-medium">大小</th>
                    <th className="px-2 py-1 font-medium">主要风险</th>
                    <th className="px-2 py-1 font-medium">建议处理</th>
                  </tr>
                </thead>
                <tbody>
                  {pocCandidates.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1 font-mono text-foreground">
                        <span
                          className="block max-w-[12rem] truncate"
                          title={row.fileName}
                        >
                          {row.fileName}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {row.fileType}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-muted-foreground">
                        {row.fileSizeLabel}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {row.primaryRisk}
                      </td>
                      <td className="px-2 py-1">
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-micro text-foreground">
                          {row.actionLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollArea>
          </section>

          <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
            <SalesPanelHeader
              title="高风险文件（示例）"
              icon={CircleAlert}
              iconTone="text-warning"
              subtitle="优先解释阻断和人工处理归因"
              actionLabel="查看入库依据"
            />
            <TableScrollArea
              label="高风险文件"
              surface="surface"
              className="mt-1.5 rounded-[4px] border border-border"
            >
              <table className="w-full min-w-[480px] text-left text-micro">
                <thead className="bg-muted/25 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 font-medium">文件名</th>
                    <th className="px-2 py-1 font-medium">风险类型</th>
                    <th className="px-2 py-1 font-medium">风险描述</th>
                    <th className="px-2 py-1 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {highRiskFiles.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1 font-mono text-foreground">
                        <span
                          className="block max-w-[12rem] truncate"
                          title={row.fileName}
                        >
                          {row.fileName}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {row.primaryRisk}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {row.riskDescription}
                      </td>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => onOpenEvidenceFile(row.id)}
                          className="inline-flex min-h-11 pointer-coarse:min-w-11 items-center px-1 text-micro text-foreground transition-colors hover:text-foreground pointer-fine:sm:min-h-0"
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollArea>
          </section>
        </div>

        <section className={cn(SALES_PANEL_CLASS, 'p-2.5')}>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                <FileSearch className="size-3.5" />
              </span>
              <div>
                <div className="text-micro font-semibold text-foreground">
                  批次数据画像
                </div>
                <div className="mt-0.5 text-micro text-muted-foreground text-pretty">
                  按 3/1000 抽代表样本，已出现的文件类型每类至少覆盖 1 个
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-micro">
              <span className="rounded-full border border-border bg-muted/25 px-2 py-1 text-muted-foreground">
                {sourceLabel}
              </span>
              <span className="rounded-full border border-border bg-muted px-2 py-1 font-medium text-foreground">
                难度 {complexity}
              </span>
              <span className="rounded-[4px] border border-warning/20 bg-warning/10 px-2 py-1 font-medium text-warning">
                {pricingMode}
              </span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_210px]">
            <div className="h-[15rem] rounded-[4px] border border-border bg-card/86 p-2">
              <EChart option={batchProfileBarOption} />
            </div>
            <div className="grid gap-2">
              <div className="rounded-[4px] border border-border bg-muted/18 px-3 py-2.5">
                <div className="text-micro text-muted-foreground">
                  预检样本
                </div>
                <div className="mt-1 text-title-sm font-semibold text-foreground tabular-nums">
                  {sampleTarget || '--'} 个
                </div>
                <div className="mt-1 text-micro text-muted-foreground">
                  {sampleTargetDetail}
                </div>
              </div>
              <div className="rounded-[4px] border border-border bg-muted/18 px-3 py-2.5">
                <div className="text-micro text-muted-foreground">
                  批次体量
                </div>
                <div className="mt-1 font-mono text-compact font-semibold text-foreground tabular-nums">
                  {totalSizeLabel}
                </div>
                <div className="mt-1 text-micro text-muted-foreground">
                  {samplePoolLabel}
                </div>
              </div>
              <div className="rounded-[4px] border border-border bg-muted/18 px-3 py-2.5 text-micro leading-3.5 text-muted-foreground text-pretty">
                {imageProxyNote}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
