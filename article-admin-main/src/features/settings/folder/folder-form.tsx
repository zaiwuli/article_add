import { useEffect } from 'react'
import type z from 'zod'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { getCategories } from '@/api/article'
import { getConfig, postConfig } from '@/api/config'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { DOWNLOADER_META } from '@/features/settings/data/downloader-list'
import { FolderItem } from '@/features/settings/folder/components/folder-item-form.tsx'
import {
  folderFormSchema,
  type folderSchema,
} from '@/features/settings/folder/schema.ts'

export interface DownloaderConfig {
  id: string
  name: string
  save_paths: {
    label: string
    path: string
  }[]
}

export function FolderForm() {
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(folderFormSchema),
    defaultValues: { folders: [] },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'folders',
  })

  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const res =
        await getConfig<z.infer<typeof folderSchema>[]>('DownloadFolder')
      return res.data || []
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['category'],
    queryFn: async () => (await getCategories()).data,
  })

  const { data: downloaders = [] } = useQuery<DownloaderConfig[]>({
    queryKey: ['downloaders'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        DOWNLOADER_META.map((d) =>
          getConfig<DownloaderConfig>(`Downloader.${d.id}`)
        )
      )

      return results
        .map((r, i) =>
          r.status === 'fulfilled' && r.value?.data?.save_paths?.length
            ? {
                id: DOWNLOADER_META[i].id,
                name: DOWNLOADER_META[i].name,
                save_paths: r.value.data.save_paths,
              }
            : null
        )
        .filter(Boolean) as DownloaderConfig[]
    },
  })

  useEffect(() => {
    if (foldersData) {
      form.reset({ folders: foldersData })
    }
  }, [foldersData, form])

  const onSubmit = async (values: z.infer<typeof folderFormSchema>) => {
    try {
      await postConfig('DownloadFolder', values.folders as never)
      toast.success('配置已保存')
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    } catch {
      toast.error('保存失败')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}
            className='max-w-md space-y-4'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            append({
              category: '',
              subCategory: '',
              downloader: '',
              savePath: '',
              regex: '',
            })
          }
        >
          <Plus className='mr-2 h-4 w-4' />
          添加路由
        </Button>

        {fields.map((_, index) => (
          <FolderItem
            key={index}
            index={index}
            form={form}
            categories={categories}
            downloaders={downloaders}
            remove={remove}
          />
        ))}

        <Button type='submit'>
          <Save/>
          保存配置
        </Button>
      </form>
    </Form>
  )
}
