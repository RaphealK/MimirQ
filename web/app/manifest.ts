import type { MetadataRoute } from 'next'
import { MIMIRQ_MARK_PATH } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MimirQ',
    short_name: 'MimirQ',
    description: 'Inspectable, replaceable, regression-tested enterprise RAG infrastructure',
    start_url: '/',
    display: 'standalone',
    background_color: '#0e1013',
    theme_color: '#0e1013',
    icons: [
      { src: '/brand/mimirq-mark.png', sizes: '512x512', type: 'image/png' },
      {
        src: MIMIRQ_MARK_PATH,
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
