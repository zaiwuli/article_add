import type { Article, ArticleFilter, Category } from '@/types/article.ts'
import { request } from './request'

export interface ArticleListResult {
  items: Article[]
  total: number
}

export function getArticles(params: {
  page: number
  pageSize: number
  filter: ArticleFilter
}) {
  return request<ArticleListResult>({
    url: '/articles/search',
    method: 'post',
    data: {
      page: params.page,
      per_page: params.pageSize,
      keyword: params.filter.keyword,
      section: params.filter.category,
      publish_date_range: {},
    },
  })
}

export function getCategories() {
  return request<[Category]>({ url: '/articles/categories' })
}

export function downloadArticle(tid: number) {
  return request({ url: '/articles/download', params: { tid } })
}

export function manulDownloadArticle(
  tid: number,
  downloader: string,
  savePath: string
) {
  return request({
    url: '/articles/download/manul',
    params: { tid, downloader, save_path: savePath },
  })
}
