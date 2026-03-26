import { request } from './request'
import type {
  CrawlerPreviewResult,
  CrawlerSaveResult,
  TransferArticleResult,
  TransferTableResult,
} from '@/types/config.ts'

export function previewCrawlerUrl(url: string) {
  return request<CrawlerPreviewResult>({
    url: '/crawler/preview',
    method: 'post',
    data: { url },
  })
}

export function saveCrawlerUrl(payload: { url: string; fid?: string }) {
  return request<CrawlerSaveResult>({
    url: '/crawler/save',
    method: 'post',
    data: payload,
  })
}

export function resetCrawlerResourceTable() {
  return request<{ deleted: number }>({
    url: '/crawler/reset-resource-table',
    method: 'post',
  })
}

export function resetCrawlerTestSpace() {
  return request<{
    article_deleted: number
    task_deleted: number
    config_deleted: number
    user_deleted: number
    default_username: string
    default_password: string
  }>({
    url: '/crawler/reset-test-space',
    method: 'post',
  })
}

export function getCrawlerTransferTables(payload: { database_url: string }) {
  return request<TransferTableResult>({
    url: '/crawler/transfer/tables',
    method: 'post',
    data: payload,
  })
}

export function transferCrawlerArticles(payload: {
  database_url: string
  table_name: string
}) {
  return request<TransferArticleResult>({
    url: '/crawler/transfer/articles',
    method: 'post',
    data: payload,
  })
}
