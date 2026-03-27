import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { ArticleFilter } from '@/types/article'
import { Loader2 } from 'lucide-react'
import { getArticles, getCategories } from '@/api/article'
import { useSearch } from '@/context/search-provider.tsx'
import { useDebounce } from '@/hooks/use-debounce.tsx'
import { ArticleCard } from '@/features/articles/components/article-card'
import { FilterBar } from '@/features/articles/components/filter-bar'

const PAGE_SIZE = 10

export function ArticlesMobile() {
  const { keyword } = useSearch()
  const debouncedKeyword = useDebounce(keyword, 300)
  const [filter, setFilter] = useState<ArticleFilter>({
    keyword: '',
    category: '',
  })
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['articles-infinite', filter, debouncedKeyword],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await getArticles({
        page: pageParam,
        pageSize: PAGE_SIZE,
        filter: { ...filter, keyword: debouncedKeyword },
      })
      return res.data
    },
    getNextPageParam: (lastPage, allPages) => {
      const currentTotal = allPages.reduce(
        (count, page) => count + page.items.length,
        0
      )
      return currentTotal < lastPage.total ? allPages.length + 1 : undefined
    },
    initialPageParam: 1,
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

  useEffect(() => {
    if (!loadMoreRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const articles = data?.pages.flatMap((page) => page.items) || []
  const total = data?.pages[0]?.total || 0

  return (
    <>
      <FilterBar
        value={filter}
        categories={categories || []}
        onChange={setFilter}
      />

      <div className='flex-1 overflow-y-auto'>
        <div className='grid gap-2'>
          {articles.map((article) => (
            <ArticleCard key={article.tid} article={article} />
          ))}
        </div>

        <div ref={loadMoreRef} className='py-4 text-center'>
          {isFetchingNextPage && (
            <div className='flex items-center justify-center gap-2 text-muted-foreground'>
              <Loader2 className='h-5 w-5 animate-spin' />
              <span>加载中...</span>
            </div>
          )}

          {!hasNextPage && articles.length > 0 && (
            <div className='text-sm text-muted-foreground'>
              已加载全部 {total} 条数据
            </div>
          )}
        </div>

        {isLoading && (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        )}
      </div>
    </>
  )
}
