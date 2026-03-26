import { createFileRoute } from '@tanstack/react-router'
import { SettingsCrawler } from '@/features/settings/crawler'

export const Route = createFileRoute('/_authenticated/settings/crawler')({
  component: SettingsCrawler,
})
