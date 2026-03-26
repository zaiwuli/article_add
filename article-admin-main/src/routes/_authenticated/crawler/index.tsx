import { createFileRoute } from '@tanstack/react-router'
import { CrawlerCenter } from '@/features/crawler'

export const Route = createFileRoute('/_authenticated/crawler/')({
  component: CrawlerCenter,
})
