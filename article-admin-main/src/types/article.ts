export interface Article {
  tid: number
  title: string
  section: string
  publish_date: string
  magnet: string
  preview_images: string
  sub_type: string
  size: number
  in_stock: boolean
  detail_url: string
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
