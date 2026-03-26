import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/crawler')({
  beforeLoad: () => {
    throw redirect({ to: '/crawler' })
  },
})
