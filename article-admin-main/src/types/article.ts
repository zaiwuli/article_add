export interface Article {
  id: number
  tid: number
  title: string
  publish_date: string
  magnet: string
  preview_images: string
  detail_url: string
  size: number | null
  section: string
  category: string | null
  website: string
  create_time: string
  update_time: string | null
  edk: string | null
}

export interface ArticleFilter {
  keyword: string
  category: string
}

export interface Category {
  category: string
  count: number
  items?: {
    category: string
    count: number
  }[]
}
