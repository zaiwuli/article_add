import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Plus, Save, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config.ts'
import type { CrawlerRuntimeConfig, CrawlerSection } from '@/types/config.ts'
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

  const saveSectionsMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerSettingsSchema>) => {
      return postConfig(
        'CrawlerSections',
        values.sections
          .map((item) => normalizeSection(item))
          .filter((item) => item.fid)
      )
    },
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
    mutationFn: async (values: z.infer<typeof crawlerRuntimeSchema>) => {
      return postConfig('CrawlerRuntime', values)
    },
    onSuccess: (res, values) => {
      if (res.code === 0) {
        runtimeForm.reset(values)
        queryClient.setQueryData(['crawler-runtime'], values)
        queryClient.invalidateQueries({ queryKey: ['crawler-runtime'] })
        toast.success('网络配置已保存')
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

  return (
    <div className='grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]'>
      <Card className='border-dashed'>
        <CardHeader className='pb-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='space-y-1'>
              <CardTitle>模块配置</CardTitle>
              <CardDescription>
                任务页会读取这里的模块列表。新增模块时只填 `fid` 也可以保存。
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
                <p className='text-sm text-muted-foreground'>正在加载模块配置...</p>
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
                              placeholder='例如：VR 视频区'
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
                <p className='text-sm text-muted-foreground'>正在加载网络配置...</p>
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
  )
}
