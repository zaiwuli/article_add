import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FolderSearch,
  HardDriveDownload,
  Network,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config'
import type {
  CrawlerIssueHandlingConfig,
  CrawlerRuntimeConfig,
  CrawlerSection,
} from '@/types/config'
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

const crawlerIssueHandlingSchema = z.object({
  watch_path: z.string().min(1, '请输入监控目录'),
  output_path: z.string().min(1, '请输入解压输出目录'),
})

function normalizeSection(section: Partial<CrawlerSection>) {
  return {
    fid: String(section.fid ?? '').trim(),
    section: section.section?.trim() || '',
    website: section.website?.trim() || 'sehuatang',
  }
}

export function CrawlerForm() {
  const queryClient = useQueryClient()

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

  const issueHandlingForm = useForm<z.infer<typeof crawlerIssueHandlingSchema>>({
    resolver: zodResolver(crawlerIssueHandlingSchema),
    defaultValues: {
      watch_path: '',
      output_path: '',
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

  const { data: issueHandlingData, isLoading: isIssueHandlingLoading } = useQuery({
    queryKey: ['crawler-issue-config'],
    queryFn: async () => {
      const res = await getConfig<CrawlerIssueHandlingConfig>('CrawlerIssueHandling')
      return (
        res.data ?? {
          watch_path: '',
          output_path: '',
        }
      )
    },
    staleTime: 5 * 60 * 1000,
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
    if (!issueHandlingData) {
      return
    }
    issueHandlingForm.reset({
      watch_path: issueHandlingData.watch_path ?? '',
      output_path: issueHandlingData.output_path ?? '',
    })
  }, [issueHandlingData, issueHandlingForm])

  const saveSectionsMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerSettingsSchema>) =>
      postConfig(
        'CrawlerSections',
        values.sections
          .map((item) => normalizeSection(item))
          .filter((item) => item.fid)
      ),
    onSuccess: (res, values) => {
      if (res.code !== 0) {
        return
      }
      const nextSections = values.sections
        .map((item) => normalizeSection(item))
        .filter((item) => item.fid)
      sectionsForm.reset({ sections: nextSections })
      queryClient.setQueryData(['crawler-sections'], nextSections)
      queryClient.invalidateQueries({ queryKey: ['crawler-sections'] })
      toast.success('抓取模块配置已保存')
    },
  })

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
      toast.success('网络配置已保存')
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
      toast.success('处理目录已保存')
    },
  })

  return (
    <div className='space-y-6'>
      <Card className='border-dashed'>
        <CardHeader>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='space-y-1'>
              <CardTitle>抓取模块</CardTitle>
              <CardDescription>
                任务页会直接读取这里的模块列表。新增板块时只填 `fid`
                也可以保存，后续再补中文名称。
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
              className='space-y-3'
            >
              {isSectionLoading && (
                <p className='text-sm text-muted-foreground'>
                  正在加载抓取模块...
                </p>
              )}

              {fields.length === 0 && !isSectionLoading && (
                <div className='rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground'>
                  当前还没有配置模块，点击右上角“新增模块”开始添加。
                </div>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className='rounded-lg border px-3 py-3'>
                  <div className='mb-3 flex items-center justify-between'>
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

                  <div className='grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]'>
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
                              placeholder='例如：转贴交流'
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
                          <FormLabel>站点标识</FormLabel>
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
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Network className='h-4 w-4' />
            抓取网络
          </CardTitle>
          <CardDescription>
            抓取时会实时读取这里的代理和 FlareSolverR 配置。
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

      <Card className='border-dashed'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FolderSearch className='h-4 w-4' />
            附件处理
          </CardTitle>
          <CardDescription>
            压缩包附件会先下载到监控目录，外部解压后再从输出目录扫描导入资源表。
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Form {...issueHandlingForm}>
            <form
              onSubmit={issueHandlingForm.handleSubmit((values) =>
                saveIssueHandlingMutation.mutate(values)
              )}
              className='space-y-4'
            >
              {isIssueHandlingLoading && (
                <p className='text-sm text-muted-foreground'>
                  正在加载附件处理配置...
                </p>
              )}

              <div className='grid gap-4 lg:grid-cols-2'>
                <FormField
                  control={issueHandlingForm.control}
                  name='watch_path'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>监控目录</FormLabel>
                      <FormControl>
                        <Input placeholder='例如：D:\\watch' {...field} />
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
                        <Input placeholder='例如：D:\\output' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='rounded-lg border bg-muted/30 px-4 py-3 text-sm'>
                <div className='mb-2 flex items-center gap-2 font-medium'>
                  <HardDriveDownload className='h-4 w-4' />
                  处理流程
                </div>
                <div className='space-y-1 text-muted-foreground'>
                  <div>1. 系统自动探测压缩包附件并生成处理记录。</div>
                  <div>2. 你在抓取处理页执行下载，附件会保存到监控目录。</div>
                  <div>3. 外部工具解压后，系统从输出目录扫描并导入资源表。</div>
                  <div>4. 自动解压当前未上线。</div>
                </div>
              </div>

              <Button type='submit' disabled={saveIssueHandlingMutation.isPending}>
                <Save />
                {saveIssueHandlingMutation.isPending
                  ? '保存中...'
                  : '保存附件处理配置'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
