import { useRef, useEffect } from 'react'
import type { ArticleFilter, Category } from '@/types/article.ts'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FilterBarProps {
  value: ArticleFilter
  categories: Category[]
  onChange: (v: ArticleFilter) => void
}

export function FilterBar({
                            value,
                            categories,
                            onChange,
                          }: FilterBarProps) {

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const tabsListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollAreaRef.current || !tabsListRef.current) return

    const scrollArea = scrollAreaRef.current
    const tabsList = tabsListRef.current
    const activeTab = tabsList.querySelector('[data-state="active"]') as HTMLElement

    if (activeTab) {
      const scrollContainer = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
      if (!scrollContainer) return

      const containerRect = scrollContainer.getBoundingClientRect()
      const activeRect = activeTab.getBoundingClientRect()

      const scrollLeft =
        activeTab.offsetLeft -
        containerRect.width / 2 +
        activeRect.width / 2

      scrollContainer.scrollTo({
        left: scrollLeft,
        behavior: 'smooth',
      })
    }
  }, [value.category])

  return (
    <div className='space-y-4 mb-6'>
      <ScrollArea ref={scrollAreaRef} className='w-full' type='hover' orientation='horizontal'>
        <Tabs
          value={value.category || 'all'}
          onValueChange={(v) =>
            onChange({ ...value, category: v === 'all' ? '' : v })
          }
        >
          <TabsList
            ref={tabsListRef}
          >
            <TabsTrigger
              value='all'
            >
              全部
            </TabsTrigger>

            {categories.map((c) => (
              <TabsTrigger
                key={c.category}
                value={c.category}
              >
                {c.category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </ScrollArea>
    </div>
  )
}