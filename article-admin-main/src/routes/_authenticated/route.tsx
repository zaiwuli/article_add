import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { buildRedirectTarget } from '@/lib/auth-redirect'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    const {
      auth: { accessToken },
    } = useAuthStore.getState()

    if (!accessToken) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: buildRedirectTarget(
            location.pathname,
            location.searchStr,
            location.hash
          ),
        },
      })
    }
  },
  component: AuthenticatedLayout,
})
