import { createFileRoute } from '@tanstack/react-router'
import { TransferCenter } from '@/features/transfer'

export const Route = createFileRoute('/_authenticated/transfer/')({
  component: TransferCenter,
})
