import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Blocks, Globe2, Plus, Save, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config'
import type { CrawlerSection } from '@/types/config'
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

function normalizeSection(section: Partial<CrawlerSection>) {
  return {
    fid: String(section.fid ?? '').trim(),
    section: section.section?.trim() || '',
    website: section.website?.trim() || 'sehuatang',
  }
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string
  value: number
  description: string
}) {
  return (
    <div className='rounded-xl border bg-card px-4 py-3 shadow-sm'>
      <div className='text-xs text-muted-foreground'>{title}</div>
      <div className='mt-2 text-2xl font-semibold leading-none'>{value}</div>
      <div className='mt-2 text-xs text-muted-foreground'>{description}</div>
    </div>
  )
}

export function CrawlerModuleCenter() {
  const queryClient = useQueryClient()
  const form = useForm<z.infer<typeof crawlerSettingsSchema>>({
    resolver: zodResolver(crawlerSettingsSchema),
    defaultValues: {
      sections: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'sections',
  })

  const watchedSections = form.watch('sections')

  const { data: sectionData, isLoading } = useQuery({
    queryKey: ['crawler-sections'],
    queryFn: async () => {
      const res = await getConfig<CrawlerSection[]>('CrawlerSections')
      return (res.data ?? []).map(normalizeSection)
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!sectionData) {
      return
    }
    form.reset({
      sections: sectionData,
    })
  }, [sectionData, form])

  const saveMutation = useMutation({
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
      form.reset({ sections: nextSections })
      queryClient.setQueryData(['crawler-sections'], nextSections)
      queryClient.invalidateQueries({ queryKey: ['crawler-sections'] })
      toast.success('抓取模块配置已保存')
    },
  })

  const summary = useMemo(() => {
    const normalized = (watchedSections ?? [])
      .map((item) => normalizeSection(item))
      .filter((item) => item.fid)

    return {
      total: normalized.length,
      named: normalized.filter((item) => item.section).length,
      websites: new Set(normalized.map((item) => item.website || 'sehuatang')).size,
    }
  }, [watchedSections])

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 md:grid-cols-3'>
        <SummaryCard
          title='模块总数'
          value={summary.total}
          description='任务页和抓取链路都会直接读取这些模块。'
        />
        <SummaryCard
          title='已命名模块'
          value={summary.named}
          description='建议为常用模块设置名称，任务页里会更好辨认。'
        />
        <SummaryCard
          title='站点标识数'
          value={summary.websites}
          description='可按站点标识分组，便于后续扩展多站抓取。'
        />
      </div>

      <Card className='border-dashed'>
        <CardHeader className='pb-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Blocks className='h-4 w-4' />
                模块列表
              </CardTitle>
              <CardDescription>
                模块已从抓取配置中拆出，单独维护。桌面端一行可放两张模块卡片。
              </CardDescription>
            </div>

            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() =>
                  append({
                    fid: '',
                    section: '',
                    website: 'sehuatang',
                  })
                }
              >
                <Plus className='h-4 w-4' />
                新增模块
              </Button>
              <Button
                type='button'
                size='sm'
                onClick={form.handleSubmit((values) => saveMutation.mutate(values))}
                disabled={saveMutation.isPending}
              >
                <Save className='h-4 w-4' />
                {saveMutation.isPending ? '保存中...' : '保存模块'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form className='space-y-3'>
              {isLoading && (
                <p className='text-sm text-muted-foreground'>正在加载抓取模块...</p>
              )}

              {fields.length === 0 && !isLoading && (
                <div className='rounded-xl border border-dashed px-4 py-10 text-sm text-muted-foreground'>
                  当前还没有抓取模块，点击右上角“新增模块”开始配置。
                </div>
              )}

              <div className='grid gap-3 xl:grid-cols-2'>
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className='rounded-xl border bg-card px-4 py-4 shadow-sm'
                  >
                    <div className='mb-3 flex items-center justify-between gap-3'>
                      <div className='flex items-center gap-2'>
                        <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                          <Blocks className='h-4 w-4' />
                        </div>
                        <div>
                          <p className='text-sm font-medium'>模块 {index + 1}</p>
                          <p className='text-xs text-muted-foreground'>
                            设置 FID、名称和站点标识
                          </p>
                        </div>
                      </div>

                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() => remove(index)}
                      >
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </div>

                    <div className='grid gap-3'>
                      <div className='grid items-start gap-3 sm:grid-cols-[96px_minmax(0,1fr)]'>
                        <FormField
                          control={form.control}
                          name={`sections.${index}.fid`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='text-[11px]'>FID</FormLabel>
                              <FormControl>
                                <Input className='h-9' placeholder='142' {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`sections.${index}.section`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className='text-[11px]'>模块名称</FormLabel>
                              <FormControl>
                                <Input
                                  className='h-9'
                                  placeholder='转贴交流'
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`sections.${index}.website`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className='flex items-center gap-1 text-[11px]'>
                              <Globe2 className='h-3.5 w-3.5' />
                              站点标识
                            </FormLabel>
                            <FormControl>
                              <Input
                                className='h-9'
                                placeholder='sehuatang'
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
