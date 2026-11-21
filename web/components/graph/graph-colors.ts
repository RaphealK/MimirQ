import { toTrimmedPrimitiveString } from '@/lib/primitive-text'

type GraphNodeColorLike = Readonly<{
  meta?: Record<string, unknown> | null
  type?: unknown
}>

const GRAPH_TYPE_COLOR_FAMILIES = [
  {
    color: '#d4d4d4',
    aliases: ['person', 'people', 'human', '人物', '人员', '个人', '申请人', '法人'],
  },
  {
    color: '#b3b3b3',
    aliases: ['organization', 'organisation', 'org', 'company', 'institution', 'department', '机构', '组织', '单位', '公司', '部门'],
  },
  {
    color: '#8f8f8f',
    aliases: ['location', 'place', 'address', 'region', 'area', 'city', 'district', '地区', '地点', '地址', '区域', '城市'],
  },
  {
    color: '#6b6b6b',
    aliases: ['regulation', 'policy', 'law', 'rule', 'statute', 'ordinance', '法规', '政策', '政策法规', '条例', '办法', '规范'],
  },
  {
    color: '#474747',
    aliases: ['material', 'document', 'certificate', 'license', 'form', 'file', '材料', '证件', '许可证', '表单', '文档'],
  },
  {
    color: '#c4c4c4',
    aliases: ['time', 'date', 'period', 'deadline', 'schedule', '时间', '日期', '时限', '期限'],
  },
  {
    color: '#a1a1a1',
    aliases: ['service', 'product', 'item', 'category', '事项', '服务', '产品', '品类'],
  },
  {
    color: '#7d7d7d',
    aliases: ['phone', 'email', 'contact', 'channel', '联系方式', '电话', '邮箱', '渠道'],
  },
  {
    color: '#595959',
    aliases: ['amount', 'price', 'fee', 'money', '收费', '价格', '金额', '费用'],
  },
  {
    color: '#353535',
    aliases: ['process', 'step', 'action', 'workflow', '流程', '步骤', '环节', '动作'],
  },
]

const GRAPH_TYPE_COLOR_ALIASES = new Map<string, string>(
  GRAPH_TYPE_COLOR_FAMILIES.flatMap((family) => family.aliases.map((alias) => [alias, family.color] as const))
)

// Neutral series ramp: types stay distinguishable by lightness only.
export const NODE_COLOR_PALETTE = [
  '#d4d4d4',
  '#b3b3b3',
  '#8f8f8f',
  '#6b6b6b',
  '#474747',
  '#c4c4c4',
  '#a1a1a1',
  '#7d7d7d',
  '#595959',
  '#353535',
  '#e0e0e0',
  '#9a9a9a',
]

export const EVENT_COLOR = '#a3a3a3'

function normalizeGraphType(value: unknown): string {
  return toTrimmedPrimitiveString(value).toLowerCase()
}

function hashTypeToIndex(type: string): number {
  let hash = 0
  for (let index = 0; index < type.length; index += 1) {
    hash = Math.trunc((hash * 31 + (type.codePointAt(index) ?? 0)) % 0x7fffffff)
  }
  return Math.abs(hash) % NODE_COLOR_PALETTE.length
}

function graphNodeRecord(node: unknown): GraphNodeColorLike {
  return node && typeof node === 'object' ? (node as GraphNodeColorLike) : {}
}

export function resolveGraphTypeColor(type: unknown): string {
  const normalizedType = normalizeGraphType(type)
  if (!normalizedType) {
    return NODE_COLOR_PALETTE[hashTypeToIndex('unknown')]
  }
  const semanticColor = GRAPH_TYPE_COLOR_ALIASES.get(normalizedType)
  if (semanticColor) return semanticColor
  return NODE_COLOR_PALETTE[hashTypeToIndex(normalizedType)]
}

export function buildTypeColorMap(nodes: readonly unknown[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const node of nodes) {
    const record = graphNodeRecord(node)
    const meta = record.meta && typeof record.meta === 'object' ? record.meta : {}
    const kind = toTrimmedPrimitiveString(meta.kind)
    if (kind === 'event') continue
    const type = toTrimmedPrimitiveString(meta.type ?? record.type, 'unknown')
    if (!map.has(type)) {
      map.set(type, resolveGraphTypeColor(type))
    }
  }
  return map
}
