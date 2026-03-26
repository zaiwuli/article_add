import type { Article, Category } from '@/types/article'
import { request } from './request'

export interface PublicArticleListParams {
  page: number
  per_page: number
  keyword?: string
  section?: string
  category?: string
  website?: string
}

export interface PublicArticleListResult {
  page: number
  per_page: number
  total: number
  items: Article[]
}

export function getPublicArticles(params: PublicArticleListParams) {
  return request<PublicArticleListResult>({
    url: '/public/articles',
    method: 'get',
    params,
  })
}

export function getPublicArticleCategories() {
  return request<Category[]>({
    url: '/public/articles/categories',
    method: 'get',
  })
}
