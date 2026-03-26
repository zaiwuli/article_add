import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  ExternalLink,
  Globe,
  Network,
  Plus,
  Radar,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config.ts'
import { previewCrawlerUrl } from '@/api/crawler.ts'
import type {
  CrawlerPreviewResult,
  CrawlerRuntimeConfig,
  CrawlerSection,
} from '@/types/config.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const crawlerSectionSchema = z.object({
  fid: z.string().min(1, '请输入板块 ID'),
  section: z.string().optional(),
  website: z.string().min(1, '请输入站点标识'),
})

const crawlerSettingsSchema = z.object({
  sections: z.array(crawlerSectionSchema),
})

const crawlerRuntimeSchema = z.object({
  proxy: z.string(),
  flare_solver_url: z.string(),
})

const crawlerPreviewSchema = z.object({
  url: z.string().url('请输入完整的页面 URL'),
})

export function CrawlerForm() {
  const queryClient = useQueryClient()
  const [previewResult, setPreviewResult] = useState<CrawlerPreviewResult | null>(
    null
  )

  const sectionsForm = useForm<z.infer<typeof crawlerSettingsSchema>>({
    resolver: zodResolver(crawlerSettingsSchema),
    defaultValues: {
      sections: [],
    },
  })

  const runtimeForm = useForm<z.infer<typeof crawlerRuntimeSchema>>({
    resolver: zodResolver(crawlerRuntimeSchema),
    defaultValues: {
      proxy: '',
      flare_solver_url: '',
    },
  })

  const previewForm = useForm<z.infer<typeof crawlerPreviewSchema>>({
    resolver: zodResolver(crawlerPreviewSchema),
    defaultValues: {
      url: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: sectionsForm.control,
    name: 'sections',
  })

  const { data: sectionData, isLoading: isSectionLoading } = useQuery({
    queryKey: ['crawler-sections'],
    queryFn: async () => {
      const res = await getConfig<CrawlerSection[]>('CrawlerSections')
      return res.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: runtimeData, isLoading: isRuntimeLoading } = useQuery({
    queryKey: ['crawler-runtime'],
    queryFn: async () => {
      const res = await getConfig<CrawlerRuntimeConfig>('CrawlerRuntime')
      return res.data ?? { proxy: '', flare_solver_url: '' }
    },
    staleTime: 5 * 60 * 1000,
  })

  const saveSectionsMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerSettingsSchema>) => {
      return postConfig('CrawlerSections', values.sections)
    },
    onSuccess: (res) => {
      if (res.code === 0) {
        toast.success('爬虫板块配置已保存')
        queryClient.invalidateQueries({ queryKey: ['crawler-sections'] })
      }
    },
  })

  const saveRuntimeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerRuntimeSchema>) => {
      return postConfig('CrawlerRuntime', values)
    },
    onSuccess: (res) => {
      if (res.code === 0) {
        toast.success('爬虫网络配置已保存')
        queryClient.invalidateQueries({ queryKey: ['crawler-runtime'] })
      }
    },
  })

  const previewMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerPreviewSchema>) => {
      return previewCrawlerUrl(values.url)
    },
    onSuccess: (res) => {
      if (res.code === 0 && res.data) {
        setPreviewResult(res.data)
        toast.success('抓取完成')
      }
    },
  })

  useEffect(() => {
    if (!sectionData) {
      return
    }

    sectionsForm.reset({
      sections: sectionData.map((item) => ({
        fid: item.fid,
        section: item.section,
        website: item.website || 'sehuatang',
      })),
    })
  }, [sectionData, sectionsForm])

  useEffect(() => {
    if (!runtimeData) {
      return
    }

    runtimeForm.reset({
      proxy: runtimeData.proxy ?? '',
      flare_solver_url: runtimeData.flare_solver_url ?? '',
    })
  }, [runtimeData, runtimeForm])

  const previewImages = useMemo(() => {
    return (previewResult?.article?.preview_images || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }, [previewResult])

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <Tabs defaultValue='sections' className='space-y-6'>
      <TabsList className='w-full justify-start'>
        <TabsTrigger value='sections'>板块配置</TabsTrigger>
        <TabsTrigger value='runtime'>网络配置</TabsTrigger>
        <TabsTrigger value='preview'>手动抓取</TabsTrigger>
      </TabsList>

      <TabsContent value='sections' className='space-y-4'>
        <Form {...sectionsForm}>
          <form
            onSubmit={sectionsForm.handleSubmit((values) =>
              saveSectionsMutation.mutate(values)
            )}
            className='space-y-4'
          >
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4'>
              <div className='space-y-1 text-sm text-muted-foreground'>
                <p>新增板块时，只填 `fid` 也可以保存和抓取。</p>
                <p>板块名称留空时，后端会自动生成 `forum-xxx` 占位名。</p>
              </div>
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  append({
                    fid: '',
                    section: '',
                    website: 'sehuatang',
                  })
                }
              >
                <Plus />
                新增板块
              </Button>
            </div>

            {isSectionLoading && (
              <p className='text-sm text-muted-foreground'>正在加载板块配置...</p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className='rounded-xl border p-4'>
                <div className='mb-4 flex items-center justify-between'>
                  <p className='text-sm font-medium'>板块 {index + 1}</p>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => remove(index)}
                  >
                    <Trash2 className='h-4 w-4 text-destructive' />
                  </Button>
                </div>
                <div className='grid gap-4 md:grid-cols-3'>
                  <FormField
                    control={sectionsForm.control}
                    name={`sections.${index}.fid`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>FID</FormLabel>
                        <FormControl>
                          <Input placeholder='160' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={sectionsForm.control}
                    name={`sections.${index}.section`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>板块名称</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='可选，例如 VR 视频区'
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={sectionsForm.control}
                    name={`sections.${index}.website`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>站点</FormLabel>
                        <FormControl>
                          <Input placeholder='sehuatang' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <Button type='submit' disabled={saveSectionsMutation.isPending}>
              <Save />
              保存板块配置
            </Button>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value='runtime' className='space-y-4'>
        <Card className='gap-4 border-dashed'>
          <CardHeader className='pb-0'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Network className='h-4 w-4' />
              爬虫运行网络
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-muted-foreground'>
            <p>这里配置的是爬虫运行时使用的代理和 FlareSolverR 地址。</p>
            <p>定时任务和手动抓取都会读取这里的配置，不再只依赖本地环境文件。</p>
          </CardContent>
        </Card>

        <Form {...runtimeForm}>
          <form
            onSubmit={runtimeForm.handleSubmit((values) =>
              saveRuntimeMutation.mutate(values)
            )}
            className='space-y-4'
          >
            {isRuntimeLoading && (
              <p className='text-sm text-muted-foreground'>正在加载网络配置...</p>
            )}

            <FormField
              control={runtimeForm.control}
              name='proxy'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>代理地址</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='http://127.0.0.1:7890'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={runtimeForm.control}
              name='flare_solver_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FlareSolverR 地址</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='http://127.0.0.1:8191/v1'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type='submit' disabled={saveRuntimeMutation.isPending}>
              <Save />
              保存网络配置
            </Button>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value='preview' className='space-y-4'>
        <Card className='gap-4 border-dashed'>
          <CardHeader className='pb-0'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Radar className='h-4 w-4' />
              可视化抓取指定网址
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-muted-foreground'>
            <p>支持 `forumdisplay` 列表页和 `viewthread` 详情页。</p>
            <p>输入网址后会直接调用当前爬虫链路，并显示本次抓取所使用的代理和 FlareSolverR。</p>
          </CardContent>
        </Card>

        <Form {...previewForm}>
          <form
            onSubmit={previewForm.handleSubmit((values) =>
              previewMutation.mutate(values)
            )}
            className='space-y-4'
          >
            <FormField
              control={previewForm.control}
              name='url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标网址</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://sehuatang.org/forum.php?mod=viewthread&tid=123456&mobile=2'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type='submit' disabled={previewMutation.isPending}>
              <Search />
              {previewMutation.isPending ? '抓取中...' : '抓取并预览'}
            </Button>
          </form>
        </Form>

        {previewResult && (
          <div className='space-y-4 rounded-xl border p-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='secondary'>{previewResult.mode}</Badge>
              {previewResult.fid && (
                <Badge variant='outline'>fid: {previewResult.fid}</Badge>
              )}
              {previewResult.count !== undefined && (
                <Badge variant='outline'>数量: {previewResult.count}</Badge>
              )}
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2 rounded-xl bg-muted/40 p-4'>
                <p className='text-sm font-medium'>本次使用的网络配置</p>
                <div className='space-y-1 text-sm text-muted-foreground'>
                  <p>代理：{previewResult.runtime.proxy || '未配置'}</p>
                  <p>
                    FlareSolverR：
                    {previewResult.runtime.flare_solver_url || '未配置'}
                  </p>
                </div>
              </div>

              <div className='space-y-2 rounded-xl bg-muted/40 p-4'>
                <p className='text-sm font-medium'>抓取网址</p>
                <div className='flex items-start justify-between gap-2 text-sm text-muted-foreground'>
                  <span className='break-all'>{previewResult.url}</span>
                  <a
                    href={previewResult.url}
                    target='_blank'
                    rel='noreferrer'
                    className='shrink-0 text-primary'
                  >
                    <ExternalLink className='h-4 w-4' />
                  </a>
                </div>
              </div>
            </div>

            {previewResult.mode === 'viewthread' && previewResult.article && (
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <p className='text-lg font-semibold'>
                    {previewResult.article.title}
                  </p>
                  <div className='flex flex-wrap gap-2 text-sm text-muted-foreground'>
                    {previewResult.article.tid && (
                      <Badge variant='outline'>
                        tid: {previewResult.article.tid}
                      </Badge>
                    )}
                    {previewResult.article.category && (
                      <Badge variant='outline'>
                        分类: {previewResult.article.category}
                      </Badge>
                    )}
                    {previewResult.article.publish_date && (
                      <Badge variant='outline'>
                        发布时间: {previewResult.article.publish_date}
                      </Badge>
                    )}
                    {previewResult.article.size && (
                      <Badge variant='outline'>
                        大小: {previewResult.article.size} MB
                      </Badge>
                    )}
                    {previewResult.article.website && (
                      <Badge variant='outline'>
                        <Globe className='mr-1 h-3 w-3' />
                        {previewResult.article.website}
                      </Badge>
                    )}
                  </div>
                </div>

                {previewImages.length > 0 && (
                  <div className='grid gap-3 md:grid-cols-3'>
                    {previewImages.map((image) => (
                      <a
                        key={image}
                        href={image}
                        target='_blank'
                        rel='noreferrer'
                        className='overflow-hidden rounded-xl border'
                      >
                        <img
                          src={image}
                          alt={previewResult.article?.title}
                          className='h-48 w-full object-cover'
                        />
                      </a>
                    ))}
                  </div>
                )}

                {previewResult.article.magnet && (
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between gap-2'>
                      <p className='text-sm font-medium'>Magnet</p>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() =>
                          copyText(
                            previewResult.article?.magnet || '',
                            'Magnet 已复制'
                          )
                        }
                      >
                        <Copy className='h-4 w-4' />
                        复制
                      </Button>
                    </div>
                    <Textarea
                      value={previewResult.article.magnet}
                      readOnly
                      className='min-h-28'
                    />
                  </div>
                )}
              </div>
            )}

            {previewResult.mode === 'forumdisplay' && (
              <div className='space-y-3'>
                <p className='text-sm font-medium'>列表页抓取结果</p>
                <div className='grid gap-2'>
                  {(previewResult.items || []).map((item) => (
                    <div
                      key={item.tid}
                      className='flex items-center justify-between rounded-xl border px-4 py-3'
                    >
                      <div className='space-y-1'>
                        <p className='text-sm font-medium'>tid: {item.tid}</p>
                        <p className='break-all text-xs text-muted-foreground'>
                          {item.detail_url}
                        </p>
                      </div>
                      <a
                        href={item.detail_url}
                        target='_blank'
                        rel='noreferrer'
                        className='shrink-0 text-primary'
                      >
                        <ExternalLink className='h-4 w-4' />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
