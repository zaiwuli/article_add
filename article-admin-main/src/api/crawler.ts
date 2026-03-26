import { request } from './request'
import type { CrawlerPreviewResult } from '@/types/config.ts'

export function previewCrawlerUrl(url: string) {
  return request<CrawlerPreviewResult>({
    url: '/crawler/preview',
    method: 'post',
    data: { url },
  })
}
