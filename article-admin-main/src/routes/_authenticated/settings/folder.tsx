import { createFileRoute } from '@tanstack/react-router'
import { SettingsFolder } from '@/features/settings/folder'

export const Route = createFileRoute('/_authenticated/settings/folder')({
  component: SettingsFolder,
})
