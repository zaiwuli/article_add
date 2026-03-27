import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { CrawlerCenter } from '@/features/crawler'

const crawlerSearchSchema = z.object({
  tab: z.enum(['issues', 'config', 'modules']).optional().catch('issues'),
})

export const Route = createFileRoute('/_authenticated/crawler/')({
  validateSearch: crawlerSearchSchema,
  component: CrawlerRoute,
})

function CrawlerRoute() {
  const search = Route.useSearch()
  return <CrawlerCenter activeTab={search.tab ?? 'issues'} />
}
