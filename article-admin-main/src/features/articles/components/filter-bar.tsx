import { useEffect, useRef } from 'react'
import type { ArticleFilter, Category } from '@/types/article'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface FilterBarProps {
  value: ArticleFilter
  categories: Category[]
  onChange: (v: ArticleFilter) => void
}

export function FilterBar({ value, categories, onChange }: FilterBarProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const tabsListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollAreaRef.current || !tabsListRef.current) {
      return
    }

    const scrollArea = scrollAreaRef.current
    const tabsList = tabsListRef.current
    const activeTab = tabsList.querySelector(
      '[data-state="active"]'
    ) as HTMLElement | null

    if (!activeTab) {
      return
    }

    const scrollContainer = scrollArea.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null

    if (!scrollContainer) {
      return
    }

    const containerRect = scrollContainer.getBoundingClientRect()
    const activeRect = activeTab.getBoundingClientRect()
    const scrollLeft =
      activeTab.offsetLeft - containerRect.width / 2 + activeRect.width / 2

    scrollContainer.scrollTo({
      left: scrollLeft,
      behavior: 'smooth',
    })
  }, [value.category])

  return (
    <div className='mb-6 space-y-4'>
      <ScrollArea
        ref={scrollAreaRef}
        className='w-full'
        type='hover'
        orientation='horizontal'
      >
        <Tabs
          value={value.category || 'all'}
          onValueChange={(nextValue) =>
            onChange({
              ...value,
              category: nextValue === 'all' ? '' : nextValue,
            })
          }
        >
          <TabsList ref={tabsListRef}>
            <TabsTrigger value='all'>全部</TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category.category} value={category.category}>
                {category.category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </ScrollArea>
    </div>
  )
}
