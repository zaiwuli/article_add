import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ArticleFilter } from '@/types/article.ts'
import { getArticles, getCategories } from '@/api/article.ts'
import { useSearch } from '@/context/search-provider.tsx'
import { useDebounce } from '@/hooks/use-debounce.tsx'
import { ArticleCard } from '@/features/articles/components/article-card.tsx'
import { FilterBar } from '@/features/articles/components/filter-bar.tsx'
import { ArticlePagination } from '@/features/articles/components/pagination.tsx'

const PAGE_SIZE = 30

export function ArticlesDesktop() {
  const { keyword } = useSearch()
  const debouncedKeyword = useDebounce(keyword, 300)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<ArticleFilter>({
    keyword: '',
    category: '',
  })

  const { data } = useQuery({
    queryKey: ['articles', page, filter, debouncedKeyword],
    queryFn: async () => {
      const res = await getArticles({
        page: page,
        pageSize: PAGE_SIZE,
        filter: { ...filter, keyword: debouncedKeyword },
      })
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: categories } = useQuery({
    queryKey: ['category'],
    queryFn: async () => {
      const res = await getCategories()
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const handleFilterChange = (v: ArticleFilter) => {
    setPage(1)
    setFilter(v)
  }

  return (
    <>
      <FilterBar
        value={filter}
        categories={categories || []}
        onChange={handleFilterChange}
      />

      <div className='flex-1 overflow-y-auto'>
        <div className='grid gap-2'>
          {data?.items.map((article) => (
            <ArticleCard key={article.tid} article={article} />
          ))}
        </div>
      </div>

      <div className='flex shrink-0 pt-2'>
        <ArticlePagination
          page={page}
          total={data?.total || 0}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </div>
    </>
  )
}