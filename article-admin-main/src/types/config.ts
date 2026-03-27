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

export interface CrawlerIssueHandlingConfig {
  watch_path: string
  output_path: string
}

export interface CrawlerAutoExtractConfig {
  enabled: boolean
  schedule_enabled: boolean
  schedule_cron: string
  archive_path: string
  move_original: boolean
  delete_original: boolean
  password_dictionary: string
}

export interface CrawlerIssueAttachment {
  name: string
  url: string
  ext: string
}

export interface CrawlerPreviewIssue {
  status?: string | null
  issue_type?: string | null
  stage?: string | null
  reason_code?: string | null
  reason_message?: string | null
  password_candidates?: string[]
  attachments?: CrawlerIssueAttachment[]
  title?: string | null
  category?: string | null
  publish_date?: string | null
  preview_images?: ArticleMultiValue
  size?: number | null
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
  issue?: CrawlerPreviewIssue
  runtime: CrawlerRuntimeConfig
}

export interface CrawlerIssueItem {
  id: number
  tid: number
  fid?: string | null
  title?: string | null
  publish_date?: string | null
  preview_images?: ArticleMultiValue
  detail_url: string
  size?: number | null
  section: string
  category?: string | null
  website: string
  status: string
  issue_type: string
  stage?: string | null
  reason_code?: string | null
  reason_message?: string | null
  password_candidates?: string[]
  attachment_urls: string[]
  attachment_names: string[]
  attachment_types: string[]
  retry_count: number
  create_time?: string | null
  update_time?: string | null
}

export interface CrawlerIssueListResult {
  page: number
  per_page: number
  total: number
  items: CrawlerIssueItem[]
  paths: CrawlerIssueHandlingConfig
  auto_extract: CrawlerAutoExtractConfig
  summary: {
    total: number
    failed: number
    pending_manual: number
    downloaded: number
    ignored: number
  }
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
  issue_saved?: number
  issue_id?: number
  issue_status?: string | null
  failed_ids?: number[]
  action?: 'created' | 'updated' | 'issue_saved'
  auto_process?: {
    processed?: number
    imported?: number
  }
}

export interface CrawlerAutoProcessResultItem {
  issue_id: number
  title?: string | null
  downloaded: number
  extracted: number
  imported: number
  status: string
  message: string
}

export interface CrawlerAutoProcessResult {
  total: number
  downloaded: number
  extracted: number
  imported: number
  failed: number
  items: CrawlerAutoProcessResultItem[]
}
