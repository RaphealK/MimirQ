import type { RagvizSimilarityMatrixResult } from '@/types'
import { axisLabelForItem, isRecord } from './utils'

const DEFAULT_FIELD_NAMES = ['document', 'text', 'name']

function getDefaultDisplayField(fields: string[]) {
  for (const name of DEFAULT_FIELD_NAMES) {
    if (fields.includes(name)) return name
  }
  return fields[0] || ''
}

export type VisualConfig = {
  displayFields: { xField: string; yField: string }
  similarityRange: { min: number; max: number }
  filters: { topK: { value: number; axis: 'x' | 'y' } }
  sorting: { order: string }
}

export function createDefaultVisualConfig(
  xFields: string[],
  yFields: string[]
): VisualConfig {
  const defaultXField = getDefaultDisplayField(xFields)
  const defaultYField = getDefaultDisplayField(yFields)

  return {
    displayFields: {
      xField: defaultXField,
      yField: defaultYField,
    },
    similarityRange: { min: 0, max: 1 },
    filters: { topK: { value: 0, axis: 'x' } },
    sorting: { order: 'none' },
  }
}

export function isVisualConfig(value: unknown): value is VisualConfig {
  return (
    isRecord(value) &&
    isRecord(value.displayFields) &&
    typeof value.displayFields.xField === 'string' &&
    typeof value.displayFields.yField === 'string' &&
    isRecord(value.similarityRange) &&
    typeof value.similarityRange.min === 'number' &&
    typeof value.similarityRange.max === 'number' &&
    isRecord(value.filters) &&
    isRecord(value.filters.topK) &&
    typeof value.filters.topK.value === 'number' &&
    (value.filters.topK.axis === 'x' || value.filters.topK.axis === 'y') &&
    isRecord(value.sorting) &&
    typeof value.sorting.order === 'string'
  )
}

export type SimilarityMatrixEntry = {
  xCollectionId: string
  yCollectionId: string
  xCollectionLabel: string
  yCollectionLabel: string
  result: RagvizSimilarityMatrixResult
  visualConfig: VisualConfig
}

export type MatrixButtonState = {
  applyData: boolean
  applyFilter: boolean
  exclusive: boolean
}

export type ColorSchemeKey = 'viridis' | 'plasma' | 'cividis' | 'YlGnBu' | 'hot'

// Diverging neutral scale: negative and positive drift stay distinguishable by lightness.
export const DIFFERENCE_COLORSCALE: Array<[number, string]> = [
  [0, '#1f1f1f'],
  [0.5, '#f5f5f5'],
  [1, '#8f8f8f'],
]

const DIFFERENCE_COLOR_PREVIEW =
  'linear-gradient(90deg,#1f1f1f,#f5f5f5,#8f8f8f)'

export const COLOR_SCHEMES: Array<{
  key: ColorSchemeKey
  label: string
  preview: string
  colorscale: Array<[number, string]>
}> = [
  {
    key: 'viridis',
    label: '灰阶（浅→深）',
    preview: 'linear-gradient(90deg,#ececec,#8f8f8f,#1f1f1f)',
    colorscale: [
      [0, '#ececec'],
      [0.5, '#8f8f8f'],
      [1, '#1f1f1f'],
    ],
  },
  {
    key: 'plasma',
    label: '灰阶（深→浅）',
    preview: 'linear-gradient(90deg,#1f1f1f,#8f8f8f,#ececec)',
    colorscale: [
      [0, '#1f1f1f'],
      [0.5, '#8f8f8f'],
      [1, '#ececec'],
    ],
  },
  {
    key: 'cividis',
    label: '柔灰阶',
    preview: 'linear-gradient(90deg,#e0e0e0,#9a9a9a,#4a4a4a)',
    colorscale: [
      [0, '#e0e0e0'],
      [0.5, '#9a9a9a'],
      [1, '#4a4a4a'],
    ],
  },
  {
    key: 'YlGnBu',
    label: '深灰阶',
    preview: 'linear-gradient(90deg,#d4d4d4,#6b6b6b,#0f0f0f)',
    colorscale: [
      [0, '#d4d4d4'],
      [0.5, '#6b6b6b'],
      [1, '#0f0f0f'],
    ],
  },
  {
    key: 'hot',
    label: '高对比灰阶',
    preview: 'linear-gradient(90deg,#ffffff,#808080,#000000)',
    colorscale: [
      [0, '#ffffff'],
      [0.5, '#808080'],
      [1, '#000000'],
    ],
  },
]

function colorStopsToVisualMapColors(stops: Array<[number, string]>) {
  // COLOR_SCHEMES stops are evenly spaced (0 / 0.5 / 1), so a plain color
  // array reproduces the exact same gradient in echarts visualMap.inRange.
  return stops.map(([, color]) => color)
}

export function toEchartsVisualMapColors(key: ColorSchemeKey) {
  return colorStopsToVisualMapColors(
    COLOR_SCHEMES.find((scheme) => scheme.key === key)?.colorscale ??
      COLOR_SCHEMES[0].colorscale
  )
}

export const DIFFERENCE_VISUALMAP_COLORS = colorStopsToVisualMapColors(
  DIFFERENCE_COLORSCALE
)

export function heatmapLegendBackground(
  key: ColorSchemeKey,
  isDifference: boolean
) {
  if (isDifference) return DIFFERENCE_COLOR_PREVIEW
  return (
    COLOR_SCHEMES.find((scheme) => scheme.key === key)?.preview ??
    COLOR_SCHEMES[0].preview
  )
}

export function generateUniqueLabels(
  items: Array<Record<string, unknown>>,
  field: string
) {
  const counts = new Map<string, number>()
  return items.map((item) => {
    const raw = axisLabelForItem(item, field)
    const key = raw || '(empty)'
    const next = (counts.get(key) || 0) + 1
    counts.set(key, next)
    return next === 1 ? key : `${key} (${next})`
  })
}
