import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { CrawlerRoutePage } from '@/features/crawler/route-page'

const crawlerSearchSchema = z.object({
  tab: z.enum(['issues', 'config', 'modules']).optional().catch('issues'),
})

export const Route = createFileRoute('/_authenticated/crawler/')({
  validateSearch: crawlerSearchSchema,
  component: CrawlerRoutePage,
})
