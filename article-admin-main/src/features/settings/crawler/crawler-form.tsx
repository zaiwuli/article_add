import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Network, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config.ts'
import {
  getCrawlerTransferTables,
  transferCrawlerArticles,
} from '@/api/crawler.ts'
import type {
  CrawlerRuntimeConfig,
  CrawlerSection,
  TransferArticleResult,
  TransferDatabaseConfig,
  TransferTableInfo,
} from '@/types/config.ts'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const crawlerSectionSchema = z.object({
  fid: z.string().min(1, '请输入模块 ID'),
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

const transferDatabaseSchema = z.object({
  database_url: z.string(),
  table_name: z.string(),
})

function normalizeSection(section: {
  fid: string
  section?: string
  website?: string
}) {
  return {
    fid: String(section.fid).trim(),
    section: section.section?.trim() || '',
    website: section.website?.trim() || 'sehuatang',
  }
}

function normalizeTransferConfig(config?: Partial<TransferDatabaseConfig> | null) {
  return {
    database_url: config?.database_url?.trim() || '',
    table_name: config?.table_name?.trim() || '',
  }
}

export function CrawlerForm() {
  const queryClient = useQueryClient()
  const [transferTables, setTransferTables] = useState<TransferTableInfo[]>([])
  const [transferDialect, setTransferDialect] = useState('')
  const [transferResult, setTransferResult] =
    useState<TransferArticleResult | null>(null)
  const lastAutoLoadedDatabaseUrl = useRef('')

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

  const transferForm = useForm<z.infer<typeof transferDatabaseSchema>>({
    resolver: zodResolver(transferDatabaseSchema),
    defaultValues: {
      database_url: '',
      table_name: '',
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
      return (res.data ?? []).map(normalizeSection)
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

  const { data: transferConfigData, isLoading: isTransferConfigLoading } =
    useQuery({
      queryKey: ['transfer-database-config'],
      queryFn: async () => {
        const res = await getConfig<TransferDatabaseConfig>('TransferDatabase')
        return normalizeTransferConfig(res.data)
      },
      staleTime: 5 * 60 * 1000,
    })

  const saveSectionsMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerSettingsSchema>) =>
      postConfig(
        'CrawlerSections',
        values.sections
          .map((item) => normalizeSection(item))
          .filter((item) => item.fid)
      ),
    onSuccess: (res, values) => {
      if (res.code === 0) {
        const nextSections = values.sections
          .map((item) => normalizeSection(item))
          .filter((item) => item.fid)
        sectionsForm.reset({ sections: nextSections })
        queryClient.setQueryData(['crawler-sections'], nextSections)
        queryClient.invalidateQueries({ queryKey: ['crawler-sections'] })
        toast.success('模块配置已保存')
      }
    },
  })

  const saveRuntimeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerRuntimeSchema>) =>
      postConfig('CrawlerRuntime', values),
    onSuccess: (res, values) => {
      if (res.code === 0) {
        runtimeForm.reset(values)
        queryClient.setQueryData(['crawler-runtime'], values)
        queryClient.invalidateQueries({ queryKey: ['crawler-runtime'] })
        toast.success('网络配置已保存')
      }
    },
  })

  const saveTransferConfigMutation = useMutation({
    mutationFn: async (values: z.infer<typeof transferDatabaseSchema>) =>
      postConfig('TransferDatabase', normalizeTransferConfig(values)),
    onSuccess: (res, values) => {
      if (res.code === 0) {
        const nextConfig = normalizeTransferConfig(values)
        transferForm.reset(nextConfig)
        queryClient.setQueryData(['transfer-database-config'], nextConfig)
        queryClient.invalidateQueries({ queryKey: ['transfer-database-config'] })
        toast.success('目标数据库配置已保存')
      }
    },
  })

  const loadTransferTablesMutation = useMutation({
    mutationFn: async (databaseUrl: string) =>
      getCrawlerTransferTables({ database_url: databaseUrl.trim() }),
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }

      const nextTables = res.data?.tables ?? []
      const currentTableName = transferForm.getValues('table_name').trim()

      setTransferTables(nextTables)
      setTransferDialect(res.data?.dialect ?? '')

      if (
        currentTableName &&
        nextTables.some((item) => item.qualified_name === currentTableName)
      ) {
        transferForm.setValue('table_name', currentTableName, {
          shouldDirty: false,
        })
      } else if (nextTables.length > 0) {
        transferForm.setValue('table_name', nextTables[0].qualified_name, {
          shouldDirty: true,
        })
      } else {
        transferForm.setValue('table_name', '', { shouldDirty: true })
      }

      toast.success('目标数据库表已加载')
    },
  })

  const transferArticlesMutation = useMutation({
    mutationFn: async (values: z.infer<typeof transferDatabaseSchema>) =>
      transferCrawlerArticles({
        database_url: values.database_url.trim(),
        table_name: values.table_name.trim(),
      }),
    onSuccess: (res) => {
      if (res.code === 0 && res.data) {
        setTransferResult(res.data)
        toast.success(
          `转存完成，新增 ${res.data.inserted} 条，更新 ${res.data.updated} 条`
        )
      }
    },
  })

  useEffect(() => {
    if (!sectionData) {
      return
    }

    sectionsForm.reset({
      sections: sectionData,
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

  useEffect(() => {
    if (!transferConfigData) {
      return
    }

    transferForm.reset(transferConfigData)
  }, [transferConfigData, transferForm])

  useEffect(() => {
    const databaseUrl = transferConfigData?.database_url?.trim()
    if (!databaseUrl || databaseUrl === lastAutoLoadedDatabaseUrl.current) {
      return
    }

    lastAutoLoadedDatabaseUrl.current = databaseUrl
    loadTransferTablesMutation.mutate(databaseUrl)
  }, [transferConfigData, loadTransferTablesMutation])

  const handleLoadTransferTables = () => {
    const databaseUrl = transferForm.getValues('database_url').trim()
    if (!databaseUrl) {
      toast.error('请先填写目标数据库连接串')
      return
    }

    lastAutoLoadedDatabaseUrl.current = databaseUrl
    loadTransferTablesMutation.mutate(databaseUrl)
  }

  const handleTransferArticles = transferForm.handleSubmit((values) => {
    if (!values.database_url.trim()) {
      toast.error('请先填写目标数据库连接串')
      return
    }

    if (!values.table_name.trim()) {
      toast.error('请先选择目标表')
      return
    }

    transferArticlesMutation.mutate(values)
  })

  return (
    <div className='space-y-6'>
      <div className='grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]'>
        <Card className='border-dashed'>
          <CardHeader className='pb-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='space-y-1'>
                <CardTitle>模块配置</CardTitle>
                <CardDescription>
                  任务页会直接读取这里的模块列表。新增模块时，只填 `fid`
                  也可以保存。
                </CardDescription>
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
                新增模块
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...sectionsForm}>
              <form
                onSubmit={sectionsForm.handleSubmit((values) =>
                  saveSectionsMutation.mutate(values)
                )}
                className='space-y-4'
              >
                {isSectionLoading && (
                  <p className='text-sm text-muted-foreground'>
                    正在加载模块配置...
                  </p>
                )}

                {fields.length === 0 && !isSectionLoading && (
                  <div className='rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground'>
                    还没有配置模块，点击右上角“新增模块”开始添加。
                  </div>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className='rounded-xl border p-4'>
                    <div className='mb-4 flex items-center justify-between'>
                      <p className='text-sm font-medium'>模块 {index + 1}</p>
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
                            <FormLabel>模块名称</FormLabel>
                            <FormControl>
                              <Input
                                placeholder='例如：MR 视频区'
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
                  {saveSectionsMutation.isPending ? '保存中...' : '保存模块配置'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className='border-dashed'>
          <CardHeader className='pb-4'>
            <CardTitle className='flex items-center gap-2'>
              <Network className='h-4 w-4' />
              网络配置
            </CardTitle>
            <CardDescription>
              爬虫运行时会实时读取这里的代理和 FlareSolverR 地址。
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
                    正在加载网络配置...
                  </p>
                )}

                <FormField
                  control={runtimeForm.control}
                  name='proxy'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>代理地址</FormLabel>
                      <FormControl>
                        <Input placeholder='http://127.0.0.1:7890' {...field} />
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
                        <Input placeholder='http://127.0.0.1:8191/v1' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type='submit' disabled={saveRuntimeMutation.isPending}>
                  <Save />
                  {saveRuntimeMutation.isPending ? '保存中...' : '保存网络配置'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card className='border-dashed'>
        <CardHeader className='pb-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-2'>
                <Database className='h-4 w-4' />
                目标数据库转存
              </CardTitle>
              <CardDescription>
                配置目标数据库连接后，读取已有数据表，并把本地 `article`
                数据同步过去。
              </CardDescription>
            </div>

            <div className='flex flex-wrap gap-2'>
              {transferDialect && (
                <Badge variant='outline'>驱动：{transferDialect}</Badge>
              )}
              <Badge variant='outline'>表数量：{transferTables.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...transferForm}>
            <form className='space-y-4'>
              {isTransferConfigLoading && (
                <p className='text-sm text-muted-foreground'>
                  正在加载目标数据库配置...
                </p>
              )}

              <div className='rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground'>
                目标表需要和你提供的 `article.sql` 结构一致。转存时按
                `website + tid` 同步，已存在数据会更新，不会重复新增。
              </div>

              <FormField
                control={transferForm.control}
                name='database_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目标数据库连接串</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='postgresql+psycopg2://user:password@127.0.0.1:5432/dbname'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={transferForm.control}
                name='table_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目标表</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              transferTables.length > 0
                                ? '请选择目标表'
                                : '请先读取数据库表'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className='max-h-80'>
                        {transferTables.map((table) => (
                          <SelectItem
                            key={table.qualified_name}
                            value={table.qualified_name}
                          >
                            {table.qualified_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={transferForm.handleSubmit((values) =>
                    saveTransferConfigMutation.mutate(values)
                  )}
                  disabled={saveTransferConfigMutation.isPending}
                >
                  <Save />
                  {saveTransferConfigMutation.isPending
                    ? '保存中...'
                    : '保存连接配置'}
                </Button>

                <Button
                  type='button'
                  variant='outline'
                  onClick={handleLoadTransferTables}
                  disabled={loadTransferTablesMutation.isPending}
                >
                  <RefreshCw
                    className={
                      loadTransferTablesMutation.isPending ? 'animate-spin' : ''
                    }
                  />
                  {loadTransferTablesMutation.isPending
                    ? '读取中...'
                    : '读取数据库表'}
                </Button>

                <Button
                  type='button'
                  onClick={handleTransferArticles}
                  disabled={transferArticlesMutation.isPending}
                >
                  <Send />
                  {transferArticlesMutation.isPending ? '转存中...' : '开始转存'}
                </Button>
              </div>

              {transferTables.length === 0 && (
                <div className='rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground'>
                  还没有加载到目标表。保存连接串后点击“读取数据库表”即可选择表名。
                </div>
              )}

              {transferResult && (
                <div className='grid gap-3 rounded-xl border p-4 md:grid-cols-4'>
                  <div>
                    <div className='text-xs text-muted-foreground'>目标表</div>
                    <div className='break-all text-sm font-medium'>
                      {transferResult.table_name}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs text-muted-foreground'>本次扫描</div>
                    <div className='text-sm font-medium'>
                      {transferResult.total}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs text-muted-foreground'>新增</div>
                    <div className='text-sm font-medium text-emerald-600'>
                      {transferResult.inserted}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs text-muted-foreground'>更新</div>
                    <div className='text-sm font-medium text-amber-600'>
                      {transferResult.updated}
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
