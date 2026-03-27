import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { buildRedirectTarget } from '@/lib/auth-redirect'
import { handleServerError } from '@/lib/handle-server-error'
import { ImageModeProvider } from '@/context/image-mode-provider.tsx'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { routeTree } from './routeTree.gen'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000,
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)

        if (error instanceof AxiosError && error.response?.status === 304) {
          toast.error('Content not modified')
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (!(error instanceof AxiosError)) {
        return
      }

      if (error.response?.status === 401) {
        toast.error('登录已失效，请重新登录')
        useAuthStore.getState().auth.reset()
        const { pathname, searchStr, hash } = router.state.location
        const redirect = buildRedirectTarget(pathname, searchStr, hash)
        router.navigate({ to: '/sign-in', search: { redirect } })
      }

      if (error.response?.status === 500) {
        toast.error('服务器异常')
        if (import.meta.env.PROD) {
          router.navigate({ to: '/500' })
        }
      }
    },
  }),
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <ImageModeProvider>
              <DirectionProvider>
                <RouterProvider router={router} />
              </DirectionProvider>
            </ImageModeProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
