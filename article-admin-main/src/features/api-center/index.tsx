import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Database, Link2, Power } from 'lucide-react'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

const API_SWITCH_KEY = 'PublicArticleApi'

type ApiSwitchConfig = {
  enabled: boolean
}

function getResourceApiUrl() {
  if (typeof window === 'undefined') {
    return '/api/v1/public/articles'
  }
  return `${window.location.origin}/api/v1/public/articles`
}

export function ApiCenter() {
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(true)

  const resourceApiUrl = useMemo(() => getResourceApiUrl(), [])

  const { data: apiConfig } = useQuery({
    queryKey: ['public-article-api-config'],
    queryFn: async () => {
      const res = await getConfig<ApiSwitchConfig>(API_SWITCH_KEY)
      return res.data ?? { enabled: true }
    },
    staleTime: 60 * 1000,
  })

  useEffect(() => {
    if (!apiConfig) {
      return
    }
    setEnabled(Boolean(apiConfig.enabled))
  }, [apiConfig])

  const saveMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) =>
      postConfig<ApiSwitchConfig>(API_SWITCH_KEY, { enabled: nextEnabled }),
    onSuccess: (res, nextEnabled) => {
      if (res.code === 0) {
        queryClient.setQueryData(['public-article-api-config'], {
          enabled: nextEnabled,
        })
        toast.success(nextEnabled ? 'Resource API enabled' : 'Resource API disabled')
      }
    },
  })

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resourceApiUrl)
      toast.success('API URL copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  const handleToggle = (checked: boolean) => {
    setEnabled(checked)
    saveMutation.mutate(checked)
  }

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ImageModeSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
        </div>
      </Header>

      <Main className='flex h-[calc(100vh-4rem)] flex-col gap-4'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <div className='flex items-center gap-3'>
              <Database className='h-7 w-7 text-primary' />
              <h1 className='text-2xl font-bold'>Resource API</h1>
            </div>
            <p className='max-w-3xl text-sm text-muted-foreground'>
              This page only exposes the main article table API. Crawled data is
              written to `sht.article` first, and other tools can read from this
              public endpoint.
            </p>
          </div>

          <Badge variant='outline'>
            Status: {enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Link2 className='h-4 w-4' />
              API Endpoint
            </CardTitle>
            <CardDescription>
              Main endpoint: `GET /api/v1/public/articles`
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='rounded-xl border p-4'>
              <div className='text-sm text-muted-foreground'>URL</div>
              <div className='mt-2 break-all font-mono text-sm'>
                {resourceApiUrl}
              </div>
            </div>

            <div className='rounded-xl border p-4'>
              <div className='text-sm text-muted-foreground'>Query Params</div>
              <div className='mt-2 flex flex-wrap gap-2'>
                {['page', 'per_page', 'keyword', 'section', 'category', 'website'].map(
                  (item) => (
                    <Badge key={item} variant='secondary'>
                      {item}
                    </Badge>
                  )
                )}
              </div>
            </div>

            <div className='flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4'>
              <div className='space-y-1'>
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <Power className='h-4 w-4' />
                  Public API Switch
                </div>
                <p className='text-sm text-muted-foreground'>
                  When disabled, public article APIs stop returning data.
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={saveMutation.isPending}
              />
            </div>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={handleCopy}>
                <Copy />
                Copy URL
              </Button>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
