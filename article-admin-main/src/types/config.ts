import type { ArticleMultiValue } from './article'

export interface TaskFunction {
  func_name: string
  func_label: string
  func_args_description: string
}

export interface CrawlerSection {
  fid: string
  section: string
  website: string
}

export interface CrawlerRuntimeConfig {
  proxy: string
  flare_solver_url: string
}

export interface CrawlerPreviewArticle {
  tid?: string | null
  title: string
  category?: string | null
  publish_date?: string | null
  magnet?: ArticleMultiValue
  preview_images?: ArticleMultiValue
  detail_url: string
  size?: number | null
  website?: string | null
  edk?: ArticleMultiValue
}

export interface CrawlerPreviewListItem {
  tid: number
  detail_url: string
}

export interface CrawlerPreviewResult {
  mode: 'forumdisplay' | 'viewthread'
  url: string
  fid?: string | null
  count?: number
  items?: CrawlerPreviewListItem[]
  article?: CrawlerPreviewArticle
  runtime: CrawlerRuntimeConfig
}

export interface CrawlerSaveResult {
  mode: 'forumdisplay' | 'viewthread'
  fid?: string | null
  tid?: number
  section: string
  website: string
  count?: number
  created?: number
  updated?: number
  failed_ids?: number[]
  action?: 'created' | 'updated'
}

export interface TransferDatabaseConfig {
  database_url: string
  table_name: string
}

export interface TransferTableInfo {
  schema?: string | null
  name: string
  qualified_name: string
}

export interface TransferTableResult {
  dialect: string
  tables: TransferTableInfo[]
}

export interface TransferArticleResult {
  table_name: string
  total: number
  inserted: number
  updated: number
}
