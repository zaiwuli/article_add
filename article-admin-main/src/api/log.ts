import { request } from './request'
import type { LogContentResult, LogScopeResult } from '@/types/log.ts'

export function getLogFiles() {
  return request<LogScopeResult>({
    url: '/logs/files',
    method: 'get',
  })
}

export function getLogContent(params: {
  scope: string
  name?: string
  lines?: number
}) {
  return request<LogContentResult>({
    url: '/logs/content',
    method: 'get',
    params,
  })
}
