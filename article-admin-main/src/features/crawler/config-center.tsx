import { useEffect } from 'react'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CrawlerAutoExtractConfig,
  CrawlerIssueHandlingConfig,
  CrawlerRuntimeConfig,
} from '@/types/config'
import {
  FolderSearch,
  Network,
  Save,
  ShieldCheck,
  ShieldEllipsis,
} from 'lucide-react'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea.tsx'

const crawlerRuntimeSchema = z.object({
  proxy: z.string(),
  flare_solver_url: z.string(),
})

const crawlerIssueHandlingSchema = z.object({
  watch_path: z.string().min(1, '请输入监控目录'),
  output_path: z.string().min(1, '请输入解压输出目录'),
})

const crawlerAutoExtractSchema = z.object({
  enabled: z.boolean(),
  schedule_enabled: z.boolean(),
  schedule_cron: z.string().min(1, '请输入 Cron 表达式'),
  archive_path: z.string().min(1, '请输入归档目录'),
  move_original: z.boolean(),
  delete_original: z.boolean(),
  password_dictionary: z.string(),
})

const DEFAULT_AUTO_EXTRACT: CrawlerAutoExtractConfig = {
  enabled: false,
  schedule_enabled: false,
  schedule_cron: '*/10 * * * *',
  archive_path: '',
  move_original: true,
  delete_original: false,
  password_dictionary: '',
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <div className='rounded-xl border bg-card px-4 py-3 shadow-sm'>
      <div className='text-xs text-muted-foreground'>{title}</div>
      <div className='mt-2 text-lg leading-none font-semibold'>{value}</div>
      <div className='mt-2 text-xs text-muted-foreground'>{description}</div>
    </div>
  )
}

export function CrawlerConfigCenter() {
  const queryClient = useQueryClient()

  const runtimeForm = useForm<z.infer<typeof crawlerRuntimeSchema>>({
    resolver: zodResolver(crawlerRuntimeSchema),
    defaultValues: {
      proxy: '',
      flare_solver_url: '',
    },
  })

  const issueHandlingForm = useForm<z.infer<typeof crawlerIssueHandlingSchema>>(
    {
      resolver: zodResolver(crawlerIssueHandlingSchema),
      defaultValues: {
        watch_path: '',
        output_path: '',
      },
    }
  )

  const autoExtractForm = useForm<z.infer<typeof crawlerAutoExtractSchema>>({
    resolver: zodResolver(crawlerAutoExtractSchema),
    defaultValues: DEFAULT_AUTO_EXTRACT,
  })

  const { data: runtimeData, isLoading: isRuntimeLoading } = useQuery({
    queryKey: ['crawler-runtime'],
    queryFn: async () => {
      const res = await getConfig<CrawlerRuntimeConfig>('CrawlerRuntime')
      return res.data ?? { proxy: '', flare_solver_url: '' }
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: issueHandlingData, isLoading: isIssueHandlingLoading } =
    useQuery({
      queryKey: ['crawler-issue-config'],
      queryFn: async () => {
        const res = await getConfig<CrawlerIssueHandlingConfig>(
          'CrawlerIssueHandling'
        )
        return (
          res.data ?? {
            watch_path: '',
            output_path: '',
          }
        )
      },
      staleTime: 5 * 60 * 1000,
    })

  const { data: autoExtractData, isLoading: isAutoExtractLoading } = useQuery({
    queryKey: ['crawler-auto-extract'],
    queryFn: async () => {
      const res =
        await getConfig<CrawlerAutoExtractConfig>('CrawlerAutoExtract')
      return res.data ?? DEFAULT_AUTO_EXTRACT
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!runtimeData) {
      return
    }
    runtimeForm.reset({
      proxy: runtimeData.proxy ?? '',
      flare_solver_url: runtimeData.flare_solver_url ?? '',
    })
  }, [runtimeData, runtimeForm])

  useEffect(() => {
    if (!issueHandlingData) {
      return
    }
    issueHandlingForm.reset({
      watch_path: issueHandlingData.watch_path ?? '',
      output_path: issueHandlingData.output_path ?? '',
    })
  }, [issueHandlingData, issueHandlingForm])

  useEffect(() => {
    if (!autoExtractData) {
      return
    }
    autoExtractForm.reset({
      enabled: autoExtractData.enabled ?? false,
      schedule_enabled: autoExtractData.schedule_enabled ?? false,
      schedule_cron: autoExtractData.schedule_cron ?? '*/10 * * * *',
      archive_path: autoExtractData.archive_path ?? '',
      move_original: autoExtractData.move_original ?? true,
      delete_original: autoExtractData.delete_original ?? false,
      password_dictionary: autoExtractData.password_dictionary ?? '',
    })
  }, [autoExtractData, autoExtractForm])

  const saveRuntimeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerRuntimeSchema>) =>
      postConfig('CrawlerRuntime', values),
    onSuccess: (res, values) => {
      if (res.code !== 0) {
        return
      }
      runtimeForm.reset(values)
      queryClient.setQueryData(['crawler-runtime'], values)
      queryClient.invalidateQueries({ queryKey: ['crawler-runtime'] })
      toast.success('抓取网络配置已保存')
    },
  })

  const saveIssueHandlingMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerIssueHandlingSchema>) =>
      postConfig('CrawlerIssueHandling', values),
    onSuccess: (res, values) => {
      if (res.code !== 0) {
        return
      }
      issueHandlingForm.reset(values)
      queryClient.setQueryData(['crawler-issue-config'], values)
      queryClient.invalidateQueries({ queryKey: ['crawler-issue-config'] })
      toast.success('处理目录配置已保存')
    },
  })

  const saveAutoExtractMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerAutoExtractSchema>) =>
      postConfig('CrawlerAutoExtract', values),
    onSuccess: (res, values) => {
      if (res.code !== 0) {
        return
      }
      autoExtractForm.reset(values)
      queryClient.setQueryData(['crawler-auto-extract'], values)
      queryClient.invalidateQueries({ queryKey: ['crawler-auto-extract'] })
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
      toast.success('自动下载解压配置已保存')
    },
  })

  const runtimeValues = useWatch({ control: runtimeForm.control })
  const autoExtractValues = useWatch({ control: autoExtractForm.control })
  const issueValues = useWatch({ control: issueHandlingForm.control })

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 md:grid-cols-3'>
        <SummaryCard
          title='代理网络'
          value={runtimeValues.proxy ? '已配置' : '未配置'}
          description='代理地址和 FlareSolverR 会在抓取时实时读取。'
        />
        <SummaryCard
          title='处理目录'
          value={
            issueValues.watch_path && issueValues.output_path
              ? '已就绪'
              : '待配置'
          }
          description='附件先进入监控目录，再落到解压输出目录。'
        />
        <SummaryCard
          title='自动下载解压'
          value={autoExtractValues.enabled ? '已开启' : '已关闭'}
          description='支持定时、归档和密码字典，失败资源可在抓取处理页复查。'
        />
      </div>

      <div className='grid gap-4 xl:grid-cols-[1fr_1.08fr]'>
        <Card className='border-dashed'>
          <CardHeader className='pb-4'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Network className='h-4 w-4' />
              抓取网络
            </CardTitle>
            <CardDescription>
              这里控制代理链路和 FlareSolverR，主要影响列表抓取与详情抓取。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...runtimeForm}>
              <form
                onSubmit={runtimeForm.handleSubmit((values) =>
                  saveRuntimeMutation.mutate(values)
                )}
                className='space-y-4'
              >
                {isRuntimeLoading && (
                  <p className='text-sm text-muted-foreground'>
                    正在加载抓取网络...
                  </p>
                )}

                <FormField
                  control={runtimeForm.control}
                  name='proxy'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>代理地址</FormLabel>
                      <FormControl>
                        <Input
                          className='h-10'
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
                          className='h-10'
                          placeholder='http://127.0.0.1:8191/v1'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
                  列表页、详情页和重试流程都会优先使用这里的网络配置。
                </div>

                <Button type='submit' disabled={saveRuntimeMutation.isPending}>
                  <Save className='h-4 w-4' />
                  {saveRuntimeMutation.isPending ? '保存中...' : '保存抓取网络'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className='border-dashed'>
          <CardHeader className='pb-4'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <ShieldCheck className='h-4 w-4' />
              自动下载解压
            </CardTitle>
            <CardDescription>
              开启后会按你设置的节奏处理压缩包附件，并优先尝试页面提取到的密码。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...autoExtractForm}>
              <form
                onSubmit={autoExtractForm.handleSubmit((values) =>
                  saveAutoExtractMutation.mutate(values)
                )}
                className='space-y-4'
              >
                {isAutoExtractLoading && (
                  <p className='text-sm text-muted-foreground'>
                    正在加载自动下载解压配置...
                  </p>
                )}

                <div className='grid gap-2 md:grid-cols-2'>
                  <FormField
                    control={autoExtractForm.control}
                    name='enabled'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between rounded-xl border px-4 py-3'>
                        <div className='space-y-1'>
                          <FormLabel>开启自动下载解压</FormLabel>
                          <div className='text-xs text-muted-foreground'>
                            新发现的压缩包附件会自动接入处理链路。
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={autoExtractForm.control}
                    name='schedule_enabled'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between rounded-xl border px-4 py-3'>
                        <div className='space-y-1'>
                          <FormLabel>开启定时处理</FormLabel>
                          <div className='text-xs text-muted-foreground'>
                            定时补处理待下载、待解压或待导入记录。
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-3 md:grid-cols-2'>
                  <FormField
                    control={autoExtractForm.control}
                    name='schedule_cron'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cron 表达式</FormLabel>
                        <FormControl>
                          <Input
                            className='h-10'
                            placeholder='*/10 * * * *'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={autoExtractForm.control}
                    name='archive_path'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>归档目录</FormLabel>
                        <FormControl>
                          <Input
                            className='h-10'
                            placeholder='例如：D:\\archive'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-2 md:grid-cols-2'>
                  <FormField
                    control={autoExtractForm.control}
                    name='move_original'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between rounded-xl border px-4 py-3'>
                        <div className='space-y-1'>
                          <FormLabel>成功后移动原包</FormLabel>
                          <div className='text-xs text-muted-foreground'>
                            自动归档到指定目录。
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              if (checked) {
                                autoExtractForm.setValue(
                                  'delete_original',
                                  false
                                )
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={autoExtractForm.control}
                    name='delete_original'
                    render={({ field }) => (
                      <FormItem className='flex items-center justify-between rounded-xl border px-4 py-3'>
                        <div className='space-y-1'>
                          <FormLabel>成功后删除原包</FormLabel>
                          <div className='text-xs text-muted-foreground'>
                            适合不保留原始压缩包的环境。
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              if (checked) {
                                autoExtractForm.setValue('move_original', false)
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={autoExtractForm.control}
                  name='password_dictionary'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='flex items-center gap-2'>
                        <ShieldEllipsis className='h-4 w-4' />
                        密码字典
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className='min-h-32'
                          placeholder={'一行一个密码，或用逗号分隔'}
                          {...field}
                        />
                      </FormControl>
                      <div className='text-xs text-muted-foreground'>
                        尝试顺序：空密码 {'->'} 页面提取密码 {'->'} 全局密码字典
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type='submit'
                  disabled={saveAutoExtractMutation.isPending}
                >
                  <Save className='h-4 w-4' />
                  {saveAutoExtractMutation.isPending
                    ? '保存中...'
                    : '保存自动下载解压'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card className='border-dashed'>
        <CardHeader className='pb-4'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <FolderSearch className='h-4 w-4' />
            处理目录
          </CardTitle>
          <CardDescription>
            把落盘路径单独放出来，抓取配置页只保留真正的目录与流程设置。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...issueHandlingForm}>
            <form
              onSubmit={issueHandlingForm.handleSubmit((values) =>
                saveIssueHandlingMutation.mutate(values)
              )}
              className='space-y-4'
            >
              {isIssueHandlingLoading && (
                <p className='text-sm text-muted-foreground'>
                  正在加载处理目录配置...
                </p>
              )}

              <div className='grid gap-3 lg:grid-cols-2'>
                <FormField
                  control={issueHandlingForm.control}
                  name='watch_path'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>监控目录</FormLabel>
                      <FormControl>
                        <Input
                          className='h-10'
                          placeholder='例如：D:\\watch'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={issueHandlingForm.control}
                  name='output_path'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>解压输出目录</FormLabel>
                      <FormControl>
                        <Input
                          className='h-10'
                          placeholder='例如：D:\\output'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid gap-3 md:grid-cols-3'>
                <div className='rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
                  1. 附件下载到监控目录
                </div>
                <div className='rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
                  2. 压缩包解压到输出目录
                </div>
                <div className='rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
                  3. 扫描输出并导入资源表
                </div>
              </div>

              <Button
                type='submit'
                disabled={saveIssueHandlingMutation.isPending}
              >
                <Save className='h-4 w-4' />
                {saveIssueHandlingMutation.isPending
                  ? '保存中...'
                  : '保存处理目录'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
