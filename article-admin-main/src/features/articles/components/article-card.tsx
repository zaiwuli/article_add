import { useState } from 'react'
import type { Article, ArticleMultiValue } from '@/types/article'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useImageMode } from '@/context/image-mode-provider.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ResponsiveModal } from '@/components/response-modal.tsx'

interface ArticleCardProps {
  article: Article
}

function normalizeList(value: ArticleMultiValue): string[] {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function firstValue(value: ArticleMultiValue): string {
  return normalizeList(value)[0] || ''
}

export function ArticleCard({ article }: ArticleCardProps) {
  const { mode } = useImageMode()
  const images = normalizeList(article.preview_images)
  const magnet = firstValue(article.magnet)
  const edk = firstValue(article.edk)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const activeImage = images[currentIndex] || images[0] || ''

  const handleCopy = async (value: string, successMessage: string) => {
    if (!value) {
      toast.error('当前没有可复制的内容')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      toast.success(successMessage)
    } catch (error) {
      toast.error(`复制失败，请重试：${error}`)
    }
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  return (
    <Card className='group relative flex w-full max-w-full flex-col gap-4 overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl sm:flex-row'>
      <div className='absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-blue-500 via-sky-500 to-teal-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />

      <ResponsiveModal
        title='图片预览'
        trigger={
          mode !== 'hide' && (
            <div className='relative h-48 w-full overflow-hidden rounded-xl sm:h-32 sm:w-48 sm:flex-shrink-0'>
              {!imageError && images.length > 0 ? (
                <>
                  <img
                    src={images[0]}
                    alt={article.title}
                    className={`h-full w-full cursor-zoom-in object-cover transition-all duration-500 group-hover:scale-110 ${
                      mode === 'blur' ? 'blur-md' : ''
                    }`}
                    onError={() => setImageError(true)}
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
                    <div className='absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white'>
                      <ImageIcon className='h-3 w-3' />
                      {images.length > 1 ? `${images.length} 张图片` : '预览图'}
                    </div>
                  </div>
                </>
              ) : (
                <div className='flex h-full w-full items-center justify-center bg-muted'>
                  <ImageIcon className='h-12 w-12 text-muted-foreground/30' />
                </div>
              )}
            </div>
          )
        }
      >
        <div className='relative w-auto max-w-[95vw] rounded-lg bg-black/95 p-4 sm:max-w-none'>
          <img
            src={activeImage}
            alt={`${article.title}-${currentIndex}`}
            className='max-h-[85vh] max-w-[90vw] rounded-lg object-contain'
          />

          {images.length > 1 && (
            <>
              <Button
                size='icon'
                variant='ghost'
                onClick={prevImage}
                className='absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/90 hover:text-white'
              >
                <ChevronLeft className='h-6 w-6' />
              </Button>

              <Button
                size='icon'
                variant='ghost'
                onClick={nextImage}
                className='absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/90 hover:text-white'
              >
                <ChevronRight className='h-6 w-6' />
              </Button>

              <div className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm text-white'>
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className='mt-2 flex gap-2 overflow-x-auto p-4'>
            {images.map((img, index) => (
              <button
                key={`${article.tid}-${index}`}
                type='button'
                onClick={() => setCurrentIndex(index)}
                className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  currentIndex === index
                    ? 'scale-110 border-primary shadow-lg'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={img}
                  alt={`preview-${index}`}
                  className='h-full w-full object-cover'
                />
              </button>
            ))}
          </div>
        )}
      </ResponsiveModal>

      <div className='flex min-w-0 flex-1 flex-col gap-3'>
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          <Badge variant='secondary'>{article.section}</Badge>
          {article.category && <Badge variant='outline'>{article.category}</Badge>}
          {article.publish_date && (
            <span className='text-muted-foreground'>{article.publish_date}</span>
          )}
          {article.size && (
            <span className='rounded-full bg-muted px-2.5 py-1 font-medium'>
              {article.size} MB
            </span>
          )}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h6 className='line-clamp-2 cursor-default break-words text-base font-semibold leading-snug transition-colors group-hover:text-primary sm:text-sm'>
                {article.title}
              </h6>
            </TooltipTrigger>
            <TooltipContent side='top' className='max-w-md'>
              <p className='text-sm'>{article.title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className='mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <span className='rounded-full border px-2.5 py-1'>{article.website}</span>
          {edk && <span className='rounded-full border px-2.5 py-1'>ED2K</span>}
          {article.detail_url && (
            <a
              href={article.detail_url}
              target='_blank'
              rel='noopener noreferrer'
              className='ml-auto flex items-center gap-1 transition-colors hover:text-primary'
            >
              <ExternalLink className='h-3 w-3' />
              查看详情
            </a>
          )}
        </div>
      </div>

      <div className='flex w-full gap-2 sm:w-auto sm:flex-col sm:justify-center'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size='sm'
                className='flex-1 shadow-md transition-all hover:shadow-lg sm:w-28 sm:flex-none'
                onClick={() => handleCopy(magnet, '磁力链接已复制')}
              >
                <Copy className='h-4 w-4' />
                <span className='hidden sm:inline'>复制 Magnet</span>
                <span className='sm:hidden'>Magnet</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='left' sideOffset={8}>
              <p>复制磁力链接</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {edk && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='sm'
                  variant='outline'
                  className='flex-1 shadow-md transition-all hover:shadow-lg sm:w-28 sm:flex-none'
                  onClick={() => handleCopy(edk, 'ED2K 链接已复制')}
                >
                  <Link2 className='h-4 w-4' />
                  <span className='hidden sm:inline'>复制 ED2K</span>
                  <span className='sm:hidden'>ED2K</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='left' sideOffset={8}>
                <p>复制 ED2K 链接</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </Card>
  )
}
