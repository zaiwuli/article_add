import { z } from 'zod'

export const folderSchema = z.object({
  category: z.string().min(1, '选择板块'),
  subCategory: z.string().min(1, '选择类目'),
  downloader: z.string().min(1, '选择下载器'),
  savePath: z.string().min(1, '选择保存目录'),
  regex: z.string().optional(),
})

export const folderFormSchema = z.object({
  folders: z.array(folderSchema),
})
