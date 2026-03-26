import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config.ts'
import type { CrawlerSection } from '@/types/config.ts'
import { Button } from '@/components/ui/button'
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
  fid: z.string().min(1, '请输入板块 ID'),
  section: z.string().optional(),
  website: z.string().min(1, '请输入站点标识'),
})

const crawlerSettingsSchema = z.object({
  sections: z.array(crawlerSectionSchema),
})

export function CrawlerForm() {
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

  const { data, isLoading } = useQuery({
    queryKey: ['crawler-sections'],
    queryFn: async () => {
      const res = await getConfig<CrawlerSection[]>('CrawlerSections')
      return res.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof crawlerSettingsSchema>) => {
      return postConfig('CrawlerSections', values.sections as never)
    },
    onSuccess: (res) => {
      if (res.code === 0) {
        toast.success('爬虫板块已保存')
        queryClient.invalidateQueries({ queryKey: ['crawler-sections'] })
      }
    },
  })

  useEffect(() => {
    if (!data) {
      return
    }

    form.reset({
      sections: data.map((item) => ({
        fid: item.fid,
        section: item.section,
        website: item.website || 'sehuatang',
      })),
    })
  }, [data, form])

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        className='space-y-4'
      >
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4'>
          <div className='space-y-1 text-sm text-muted-foreground'>
            <p>新增板块时，只填 `fid` 也可以保存和抓取。</p>
            <p>未填写名称时，后端会自动使用 `forum-fid` 占位名。</p>
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

        {isLoading && (
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
                control={form.control}
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
                control={form.control}
                name={`sections.${index}.section`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>板块名称</FormLabel>
                    <FormControl>
                      <Input placeholder='可留空' {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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

        <Button type='submit' disabled={saveMutation.isPending}>
          <Save />
          保存板块配置
        </Button>
      </form>
    </Form>
  )
}
