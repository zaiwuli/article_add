import { request } from './request'
import type {
  CrawlerAutoProcessResult,
  CrawlerIssueListResult,
  CrawlerPreviewResult,
  CrawlerSaveResult,
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

export function getCrawlerIssues(params: {
  page: number
  perPage: number
  status?: string
  issueType?: string
  keyword?: string
}) {
  return request<CrawlerIssueListResult>({
    url: '/crawler/issues',
    method: 'get',
    params: {
      page: params.page,
      per_page: params.perPage,
      status: params.status,
      issue_type: params.issueType,
      keyword: params.keyword,
    },
  })
}

export function retryCrawlerIssue(issueId: number) {
  return request<{
    action?: string
    deleted_issue_id?: number
    auto_process?: {
      issue_id: number
      downloaded: number
      extracted: number
      imported: number
      status: string
      message: string
    }
  }>({
    url: `/crawler/issues/${issueId}/retry`,
    method: 'post',
  })
}

export function downloadCrawlerIssue(issueId: number) {
  return request<{
    downloaded_files: string[]
    auto_process?: {
      issue_id: number
      downloaded: number
      extracted: number
      imported: number
      status: string
      message: string
    }
  }>({
    url: `/crawler/issues/${issueId}/download`,
    method: 'post',
  })
}

export function ignoreCrawlerIssue(issueId: number) {
  return request({
    url: `/crawler/issues/${issueId}/ignore`,
    method: 'post',
  })
}

export function importCrawlerIssueOutputs() {
  return request<{
    imported: number
    deleted_issue_ids: number[]
    skipped: Array<{ issue_id: number; reason: string }>
  }>({
    url: '/crawler/issues/import-outputs',
    method: 'post',
  })
}

export function processCrawlerIssuesAuto(issueId?: number) {
  return request<CrawlerAutoProcessResult>({
    url: '/crawler/issues/process-auto',
    method: 'post',
    params: issueId ? { issue_id: issueId } : undefined,
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
