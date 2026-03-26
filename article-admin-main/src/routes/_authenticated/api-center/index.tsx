import { createFileRoute } from '@tanstack/react-router'
import { ApiCenter } from '@/features/api-center'

export const Route = createFileRoute('/_authenticated/api-center/')({
  component: ApiCenter,
})
