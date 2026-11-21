/**
 * 模型提供商图标组件
 * 供应商 SVG 与通用模型图标
 */
import Image from 'next/image'
import { Cpu } from 'lucide-react'

interface ProviderIconProps {
  providerId: string
  className?: string
}

/**
 * 优先使用 LobeHub 品牌 SVG（web/public/logos/lobehub/*.svg）。
 * 本地模型用既有本地 SVG，未知供应商显示通用图标。
 */
const LOBEHUB_ICON_BY_PROVIDER_ID: Record<string, string> = {
  openai: 'openai',
  'openai-embedding': 'openai',

  anthropic: 'anthropic',

  deepseek: 'deepseek',

  zhipu: 'zhipu',
  zhipuai: 'zhipu',

  qwen: 'qwen',
  'qwen-embedding': 'qwen',
  dashscope: 'qwen',

  moonshot: 'moonshot',
  ollama: 'ollama',

  // 产品/提供商别名
  ark: 'doubao',
  doubao: 'doubao',

  lingyiwanwu: 'yi',
  yi: 'yi',

  qianfan: 'wenxin',
  baidu: 'wenxin',
  wenxin: 'wenxin',

  siliconflow: 'siliconcloud',
  siliconcloud: 'siliconcloud',

  openrouter: 'openrouter',
  openrouterai: 'openrouter',

  together: 'together',
  togetherai: 'together',

  'cohere-reranker': 'cohere',
  cohere: 'cohere',

  'jina-reranker': 'jina',
  jina: 'jina',
}

function normalizeProviderId(providerId: string): string {
  return String(providerId || '').trim().toLowerCase()
}

const localIcons: Record<string, string> = {
  local: 'local', 'local-embedding': 'local', reranker: 'reranker', 'local-reranker': 'reranker',
}

export function ProviderIcon({ providerId, className = 'w-8 h-8' }: Readonly<ProviderIconProps>) {
  const pid = normalizeProviderId(providerId)
  const lobehubIconName = LOBEHUB_ICON_BY_PROVIDER_ID[pid]

  if (lobehubIconName) {
    return (
      <Image
        src={`/logos/lobehub/${lobehubIconName}.svg`}
        alt={`${providerId} logo`}
        width={32}
        height={32}
        className={`${className} grayscale`}
        priority
        unoptimized
      />
    )
  }

  const local = localIcons[pid]
  if (!local) return <Cpu role="img" aria-label={`${providerId} logo`} className={className} />
  return <Image src={`/logos/${local}.svg`} alt={`${providerId} logo`} width={32} height={32}
    className={`${className} grayscale`} unoptimized />
}
