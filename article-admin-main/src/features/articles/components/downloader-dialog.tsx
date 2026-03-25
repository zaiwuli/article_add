import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Article } from '@/types/article.ts'
import { Download, FolderOpen, HardDrive, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  type ArticleListResult,
  downloadArticle,
  manulDownloadArticle,
} from '@/api/article'
import { getConfig } from '@/api/config'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DOWNLOADER_META } from '@/features/settings/data/downloader-list.ts'
import type { DownloaderConfig } from '@/features/settings/folder/folder-form.tsx'

interface DownloaderDialogProps {
  articleId: number
  trigger?: React.ReactNode
}

function isValidDownloader(data: DownloaderConfig) {
  return data && Array.isArray(data.save_paths) && data.save_paths.length > 0
}

export function DownloaderDialog({
  articleId,
  trigger,
}: DownloaderDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedDownloader, setSelectedDownloader] = useState<string>('auto')
  const [selectedPath, setSelectedPath] = useState<string>('auto')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const { data: downloaders = [], isLoading } = useQuery<DownloaderConfig[]>({
    queryKey: ['downloaders'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        DOWNLOADER_META.map((d) =>
          getConfig<DownloaderConfig>(`Downloader.${d.id}`)
        )
      )

      return results
        .map((res, index) => {
          if (res.status !== 'fulfilled') return null
          const data = res.value?.data ?? {}
          if (isValidDownloader(data)) {
            return {
              id: DOWNLOADER_META[index].id,
              name: DOWNLOADER_META[index].name,
              save_paths: data.save_paths,
            } satisfies DownloaderConfig
          }
          return null
        })
        .filter(Boolean) as DownloaderConfig[]
    },
    staleTime: 5 * 60 * 1000,
    enabled: open, // 只在打开时请求
  })

  // 当选择下载器时，自动选择第一个路径
  const handleDownloaderChange = (downloaderId: string) => {
    setSelectedDownloader(downloaderId)
    if (downloaderId === 'auto') {
      setSelectedPath('auto')
    } else {
      const downloader = downloaders.find((d) => d.id === downloaderId)
      if (downloader && downloader.save_paths.length > 0) {
        setSelectedPath(downloader.save_paths[0].path)
      }
    }
  }

  // 获取当前选中的下载器配置
  const currentDownloader = downloaders.find((d) => d.id === selectedDownloader)

  const updateSockStatus = () => {
    queryClient.setQueriesData(
      { queryKey: ['articles'], exact: false },
      (oldData: ArticleListResult) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          items: oldData.items.map((item: Article) =>
            item.tid === articleId ? { ...item, in_stock: true } : item
          ),
        }
      }
    )
  }

  const handleSubmit = async () => {
    if (!selectedDownloader || !selectedPath) {
      toast.error('请选择下载器和下载目录')
      return
    }
    try {
      setIsSubmitting(true)
      if (selectedDownloader === 'auto') {
        const res = await downloadArticle(articleId)
        toast.success(res.message || '推送成功')
      } else {
        const res = await manulDownloadArticle(
          articleId,
          selectedDownloader,
          selectedPath
        )
        toast.success(res.message || '推送成功')
      }
      setOpen(false)
      setSelectedDownloader('')
      setSelectedPath('')
      updateSockStatus()
    } catch (err) {
      toast.error(`推送失败，请重试:${err}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size='sm' variant='outline'>
            <Download className='h-4 w-4' />
            推送下载
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Download className='h-5 w-5' />
            选择下载器
          </DialogTitle>
          <DialogDescription>请选择要使用的下载器和保存目录</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex h-48 items-center justify-center'>
            <div className='flex flex-col items-center gap-2 text-muted-foreground'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
              <p className='text-sm'>加载配置中...</p>
            </div>
          </div>
        ) : downloaders.length === 0 ? (
          <div className='flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground'>
            <HardDrive className='h-12 w-12 opacity-30' />
            <p className='text-sm'>未配置任何下载器</p>
            <p className='text-xs'>请先在设置中配置下载器</p>
          </div>
        ) : (
          <div className='space-y-6 py-4'>
            {/* 下载器选择 */}
            <div className='space-y-3'>
              <Label className='flex items-center gap-2 text-sm font-medium'>
                <HardDrive className='h-4 w-4' />
                下载器
              </Label>
              <RadioGroup
                value={selectedDownloader}
                onValueChange={handleDownloaderChange}
                className='space-y-2'
              >
                <div
                  className={`flex items-center space-x-3 rounded-lg border p-3 transition-all ${
                    selectedDownloader === 'auto'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value='auto' id='auto' />
                  <Label
                    htmlFor='auto'
                    className='flex flex-1 cursor-pointer items-center justify-between'
                  >
                    <div className='flex flex-col gap-1'>
                      <span className='font-medium'>🎯 自动选择（推荐）</span>
                      <span className='text-xs text-muted-foreground'>
                        由服务端自动判断最佳下载器和目录
                      </span>
                    </div>
                    {selectedDownloader === 'auto' && (
                      <Check className='h-4 w-4 flex-shrink-0 text-primary' />
                    )}
                  </Label>
                </div>

                <Separator />
                {downloaders.map((downloader) => (
                  <div
                    key={downloader.id}
                    className={`flex items-center space-x-3 rounded-lg border p-3 transition-all ${
                      selectedDownloader === downloader.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value={downloader.id} id={downloader.id} />
                    <Label
                      htmlFor={downloader.id}
                      className='flex flex-1 cursor-pointer items-center justify-between'
                    >
                      <span className='font-medium'>{downloader.name}</span>
                      {selectedDownloader === downloader.id && (
                        <Check className='h-4 w-4 text-primary' />
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* 下载目录选择 */}
            {selectedDownloader !== 'auto' && currentDownloader && (
              <div className='space-y-3'>
                <Label className='flex items-center gap-2 text-sm font-medium'>
                  <FolderOpen className='h-4 w-4' />
                  下载目录
                  <span className='text-xs font-normal text-muted-foreground'>
                    ({currentDownloader.save_paths.length} 个可用目录)
                  </span>
                </Label>
                <ScrollArea className='h-[200px] rounded-md border'>
                  <RadioGroup
                    value={selectedPath}
                    onValueChange={setSelectedPath}
                    className='p-2'
                  >
                    {currentDownloader.save_paths.map((path, index) => (
                      <div
                        key={index}
                        className={`flex items-start space-x-3 rounded-md p-3 transition-all ${
                          selectedPath === path.path
                            ? 'bg-primary/10'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem
                          value={path.path}
                          id={`path-${index}`}
                          className='mt-0.5'
                        />
                        <Label
                          htmlFor={`path-${index}`}
                          className='flex flex-1 cursor-pointer items-center justify-between gap-2'
                        >
                          <span className='font-mono text-sm break-all'>
                            {path.path}
                          </span>
                          {selectedPath === path.path && (
                            <Check className='h-4 w-4 flex-shrink-0 text-primary' />
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedDownloader || !selectedPath || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
                推送中...
              </>
            ) : (
              <>
                <Download className='mr-2 h-4 w-4' />
                确认推送
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
