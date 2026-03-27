import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { buildRedirectTarget } from '@/lib/auth-redirect'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

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
