import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Database, Link2, Power } from 'lucide-react'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

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

  const resourceApiUrl = useMemo(() => getResourceApiUrl(), [])

  const { data: apiConfig } = useQuery({
    queryKey: ['public-article-api-config'],
    queryFn: async () => {
      const res = await getConfig<ApiSwitchConfig>(API_SWITCH_KEY)
      return res.data ?? { enabled: true }
    },
    staleTime: 60 * 1000,
  })

  const saveMutation = useMutation({
    mutationFn: async (nextEnabled: boolean) =>
      postConfig<ApiSwitchConfig>(API_SWITCH_KEY, { enabled: nextEnabled }),
    onMutate: async (nextEnabled) => {
      const previous = queryClient.getQueryData<ApiSwitchConfig>([
        'public-article-api-config',
      ])
      queryClient.setQueryData(['public-article-api-config'], {
        enabled: nextEnabled,
      })
      return { previous }
    },
    onError: (_error, _nextEnabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['public-article-api-config'],
          context.previous
        )
      }
    },
    onSuccess: (res, nextEnabled) => {
      if (res.code === 0) {
        queryClient.setQueryData(['public-article-api-config'], {
          enabled: nextEnabled,
        })
        toast.success(nextEnabled ? '资源接口已开启' : '资源接口已关闭')
      }
    },
  })

  const enabled = Boolean(apiConfig?.enabled ?? true)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resourceApiUrl)
      toast.success('接口地址已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleToggle = (checked: boolean) => {
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
              <h1 className='text-2xl font-bold'>资源接口</h1>
            </div>
            <p className='max-w-3xl text-sm text-muted-foreground'>
              这里仅提供资源主表的公开读取接口。爬虫会先把数据写入
              `sht.article`，其他工具再通过这个接口读取。
            </p>
          </div>

          <Badge variant='outline'>状态：{enabled ? '已开启' : '已关闭'}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Link2 className='h-4 w-4' />
              接口地址
            </CardTitle>
            <CardDescription>
              主接口：`GET /api/v1/public/articles`
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='rounded-xl border p-4'>
              <div className='text-sm text-muted-foreground'>地址</div>
              <div className='mt-2 font-mono text-sm break-all'>
                {resourceApiUrl}
              </div>
            </div>

            <div className='rounded-xl border p-4'>
              <div className='text-sm text-muted-foreground'>可用参数</div>
              <div className='mt-2 flex flex-wrap gap-2'>
                {[
                  'page',
                  'per_page',
                  'keyword',
                  'section',
                  'category',
                  'website',
                ].map((item) => (
                  <Badge key={item} variant='secondary'>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>

            <div className='flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4'>
              <div className='space-y-1'>
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <Power className='h-4 w-4' />
                  接口开关
                </div>
                <p className='text-sm text-muted-foreground'>
                  关闭后，公开资源接口将不再返回数据。
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
                复制地址
              </Button>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
