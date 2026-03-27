import { useSearch } from '@tanstack/react-router'
import { CrawlerCenter } from '@/features/crawler'

export function CrawlerRoutePage() {
  const search = useSearch({ from: '/_authenticated/crawler/' })
  return <CrawlerCenter activeTab={search.tab ?? 'issues'} />
}
