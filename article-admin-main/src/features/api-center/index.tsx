import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Braces, Copy, Database, Link2, SearchCode } from 'lucide-react'
import { toast } from 'sonner'
import { getPublicArticleCategories, getPublicArticles } from '@/api/public'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type QueryForm = {
  page: number
  per_page: number
  keyword: string
  section: string
  category: string
  website: string
}

const DEFAULT_QUERY: QueryForm = {
  page: 1,
  per_page: 20,
  keyword: '',
  section: '',
  category: '',
  website: '',
}

const BASE_URL =
  typeof window === 'undefined'
    ? '/api/v1'
    : `${window.location.origin}/api/v1`

function buildQueryString(values: QueryForm) {
  const params = new URLSearchParams()
  params.set('page', String(values.page))
  params.set('per_page', String(values.per_page))

  if (values.keyword.trim()) {
    params.set('keyword', values.keyword.trim())
  }
  if (values.section.trim()) {
    params.set('section', values.section.trim())
  }
  if (values.category.trim()) {
    params.set('category', values.category.trim())
  }
  if (values.website.trim()) {
    params.set('website', values.website.trim())
  }

  return params.toString()
}

function buildEndpointUrl(path: string, queryString?: string) {
  if (!queryString) {
    return `${BASE_URL}${path}`
  }
  return `${BASE_URL}${path}?${queryString}`
}

function formatMultiValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.join(' | ')
  }
  return value || '-'
}

export function ApiCenter() {
  const [draft, setDraft] = useState<QueryForm>(DEFAULT_QUERY)
  const [submitted, setSubmitted] = useState<QueryForm>(DEFAULT_QUERY)

  const queryString = useMemo(() => buildQueryString(submitted), [submitted])
  const articlesUrl = useMemo(
    () => buildEndpointUrl('/public/articles', queryString),
    [queryString]
  )

  const { data: categories } = useQuery({
    queryKey: ['public-article-categories'],
    queryFn: async () => {
      const res = await getPublicArticleCategories()
      return res.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: articleResult,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['public-articles', submitted],
    queryFn: async () => {
      const res = await getPublicArticles(submitted)
      return res.data
    },
    staleTime: 30 * 1000,
  })

  const responseText = useMemo(
    () => JSON.stringify(articleResult ?? {}, null, 2),
    [articleResult]
  )

  const totalCategoryCount = useMemo(
    () => (categories ?? []).reduce((sum, item) => sum + item.count, 0),
    [categories]
  )

  const handleCopy = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(message)
    } catch {
      toast.error('复制失败')
    }
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
              这里只提供已经写入 `article` 资源表的数据接口。爬虫任务执行完成后，外部工具直接调用这些接口即可读取入表数据。
            </p>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>基础地址：{BASE_URL}</Badge>
            <Badge variant='outline'>
              当前分类总数：{totalCategoryCount}
            </Badge>
          </div>
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'>
          <div className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Link2 className='h-4 w-4' />
                  可调用接口
                </CardTitle>
                <CardDescription>
                  只保留资源表相关的公开读取接口，不再提供通用调试器。
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='rounded-xl border p-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <div>
                      <div className='font-medium'>资源列表</div>
                      <div className='mt-1 font-mono text-xs text-muted-foreground'>
                        GET {articlesUrl}
                      </div>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => handleCopy(articlesUrl, '资源列表地址已复制')}
                    >
                      <Copy />
                      复制
                    </Button>
                  </div>
                </div>

                <div className='rounded-xl border p-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <div>
                      <div className='font-medium'>分类统计</div>
                      <div className='mt-1 font-mono text-xs text-muted-foreground'>
                        GET {BASE_URL}/public/articles/categories
                      </div>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        handleCopy(
                          `${BASE_URL}/public/articles/categories`,
                          '分类统计地址已复制'
                        )
                      }
                    >
                      <Copy />
                      复制
                    </Button>
                  </div>
                </div>

                <div className='rounded-xl border p-3'>
                  <div className='font-medium'>推荐调用方式</div>
                  <p className='mt-2 text-sm text-muted-foreground'>
                    外部工具优先调用 `GET /public/articles`。需要筛选时直接带查询参数，例如
                    `page`、`per_page`、`keyword`、`section`、`category`、`website`。
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <SearchCode className='h-4 w-4' />
                  查询参数
                </CardTitle>
                <CardDescription>
                  设置查询条件后，右侧会直接预览资源表返回结果。
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>页码</label>
                    <Input
                      type='number'
                      min={1}
                      value={draft.page}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          page: Math.max(1, Number(event.target.value) || 1),
                        }))
                      }
                    />
                  </div>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>每页条数</label>
                    <Input
                      type='number'
                      min={1}
                      max={100}
                      value={draft.per_page}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          per_page: Math.max(
                            1,
                            Math.min(100, Number(event.target.value) || 20)
                          ),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>关键词</label>
                  <Input
                    value={draft.keyword}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        keyword: event.target.value,
                      }))
                    }
                    placeholder='标题关键词'
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>板块</label>
                  <Input
                    value={draft.section}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        section: event.target.value,
                      }))
                    }
                    placeholder='例如：转贴交流'
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>分类</label>
                  <Input
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder='例如：亚洲有码'
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>站点</label>
                  <Input
                    value={draft.website}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        website: event.target.value,
                      }))
                    }
                    placeholder='例如：sehuatang'
                  />
                </div>

                <div className='flex flex-wrap justify-end gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      setDraft(DEFAULT_QUERY)
                      setSubmitted(DEFAULT_QUERY)
                    }}
                  >
                    重置
                  </Button>
                  <Button
                    type='button'
                    onClick={() => setSubmitted({ ...draft })}
                  >
                    查询资源数据
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className='space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <CardTitle className='text-base'>接口返回预览</CardTitle>
                    <CardDescription>
                      这里显示资源表接口实际返回的数据。
                    </CardDescription>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='outline'>
                      总数：{articleResult?.total ?? 0}
                    </Badge>
                    <Badge variant='outline'>
                      本页：{articleResult?.items?.length ?? 0}
                    </Badge>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => refetch()}
                    >
                      {isFetching ? '刷新中...' : '刷新'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='rounded-xl border bg-muted/20 px-3 py-2 text-sm'>
                  <div className='text-muted-foreground'>当前调用地址</div>
                  <div className='break-all font-mono text-xs'>{articlesUrl}</div>
                </div>

                <div className='grid gap-3'>
                  {(articleResult?.items ?? []).map((item) => (
                    <div key={item.id} className='rounded-xl border p-3'>
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div className='font-medium'>{item.title}</div>
                        <Badge variant='outline'>tid: {item.tid}</Badge>
                      </div>
                      <div className='mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground'>
                        <Badge variant='secondary'>{item.section}</Badge>
                        {item.category && (
                          <Badge variant='secondary'>{item.category}</Badge>
                        )}
                        <Badge variant='secondary'>{item.website}</Badge>
                        {item.publish_date && (
                          <Badge variant='secondary'>{item.publish_date}</Badge>
                        )}
                      </div>
                      <div className='mt-3 grid gap-2 text-xs text-muted-foreground'>
                        <div className='break-all'>详情：{item.detail_url}</div>
                        <div className='break-all'>
                          磁力：{formatMultiValue(item.magnet)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {(articleResult?.items?.length ?? 0) === 0 && (
                    <div className='rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground'>
                      当前条件下没有查询到资源数据。
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Braces className='h-4 w-4' />
                  JSON 响应
                </CardTitle>
                <CardDescription>
                  如果外部工具直接对接，可以参考这里的完整返回结构。
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex justify-end'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => handleCopy(responseText, 'JSON 响应已复制')}
                  >
                    <Copy />
                    复制 JSON
                  </Button>
                </div>
                <Textarea
                  value={responseText}
                  readOnly
                  rows={20}
                  className='font-mono text-xs'
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}
