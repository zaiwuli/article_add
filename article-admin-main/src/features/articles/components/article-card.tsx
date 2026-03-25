import { useState } from 'react'
import type { Article } from '@/types/article'
import {
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
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
import { DownloaderDialog } from './downloader-dialog'

interface ArticleCardProps {
  article: Article
}

export function ArticleCard({ article }: ArticleCardProps) {
  const { mode } = useImageMode()
  const images = article.preview_images.split(',').filter(Boolean)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageError, setImageError] = useState(false)

  const handleCopyMagnet = async () => {
    try {
      await navigator.clipboard.writeText(article.magnet)
      toast.success('磁力链接已复制到剪贴板')
    } catch (err) {
      toast.error(`复制失败，请重试${err}`)
    }
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  return (
    <Card className='group glass-card relative flex w-full max-w-full flex-col gap-4 overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl sm:flex-row'>
      {/* 渐变装饰条 */}
      <div className='absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />

      {/* 左侧：图片 */}
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
                  {/* 图片遮罩层 */}
                  <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
                    <div className='absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white'>
                      <ImageIcon className='h-3 w-3' />
                      {images.length > 1 && `${images.length} 张图片`}
                    </div>
                  </div>
                  {/* 放大提示 */}
                  <div className='absolute top-2 right-2 rounded-full bg-black/50 p-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
                    <ImageIcon className='h-4 w-4 text-white' />
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
        <div className='glass-popover relative w-auto max-w-[95vw] rounded-lg border-none bg-black/95 p-0 p-4 sm:max-w-none'>
          <img
            src={images[currentIndex]}
            alt={`${article.title}-${currentIndex}`}
            className='max-h-[85vh] max-w-[90vw] rounded-lg object-contain'
          />

          {/* 图片导航按钮 */}
          {images.length > 1 && (
            <>
              <Button
                size='icon'
                variant='ghost'
                onClick={prevImage}
                className='absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/90 hover:text-white'
              >
                <ChevronLeft className='h-6 w-6' />
              </Button>

              <Button
                size='icon'
                variant='ghost'
                onClick={nextImage}
                className='absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/90 hover:text-white'
              >
                <ChevronRight className='h-6 w-6' />
              </Button>

              {/* 图片计数器 */}
              <div className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm text-white'>
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {/* 缩略图导航 */}
        {images.length > 1 && (
          <div className='scrollbar-thin mt-2 flex gap-2 overflow-x-auto p-4'>
            {images.map((img, index) => (
              <button
                key={index}
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
      {/* 中间：内容区 */}
      <div className='flex min-w-0 flex-1 flex-col gap-3'>
        {/* 标签和日期 */}
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          <Badge variant='secondary' className='shadow-sm'>
            {article.section}
          </Badge>

          {article.sub_type && (
            <Badge variant='outline' className='shadow-sm'>
              {article.sub_type}
            </Badge>
          )}

          <span className='flex items-center gap-1 text-muted-foreground'>
            <svg
              className='h-3 w-3'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
              />
            </svg>
            {article.publish_date}
          </span>
        </div>

        {/* 标题 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h6 className='line-clamp-2 cursor-default text-base leading-snug font-semibold break-words transition-colors group-hover:text-primary sm:text-sm'>
                {article.title}
              </h6>
            </TooltipTrigger>
            <TooltipContent side='top' className='max-w-md'>
              <p className='text-sm'>{article.title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 底部状态信息 */}
        <div className='mt-auto flex flex-wrap items-center gap-3 text-xs'>
          {article.size && (
            <span className='flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium'>
              <svg
                className='h-3 w-3'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
                />
              </svg>
              {article.size} MB
            </span>
          )}

          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
              article.in_stock
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            }`}
          >
            {article.in_stock ? (
              <>
                <svg
                  className='h-3 w-3'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                    clipRule='evenodd'
                  />
                </svg>
                已下载
              </>
            ) : (
              <>
                <svg
                  className='h-3 w-3 animate-spin'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  ></circle>
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  ></path>
                </svg>
                未下载
              </>
            )}
          </span>

          {article.detail_url && (
            <a
              href={article.detail_url}
              target='_blank'
              rel='noopener noreferrer'
              className='ml-auto flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary'
            >
              <ExternalLink className='h-3 w-3' />
              查看详情
            </a>
          )}
        </div>
      </div>

      {/* 右侧：操作按钮 */}
      <div className='flex w-full gap-2 sm:w-auto sm:flex-col sm:justify-center'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size='sm'
                className='flex-1 shadow-md transition-all hover:shadow-lg sm:w-28 sm:flex-none'
                onClick={handleCopyMagnet}
              >
                <Copy className='h-4 w-4' />
                <span className='hidden sm:inline'>复制磁力</span>
                <span className='sm:hidden'>复制</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='left' sideOffset={8}>
              <p>复制磁力链接</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DownloaderDialog
                articleId={article.tid}
                trigger={
                  <Button
                    size='sm'
                    variant='outline'
                    className='flex-1 shadow-md transition-all hover:shadow-lg sm:w-28 sm:flex-none'
                  >
                    <Download className='h-4 w-4' />
                    <span className='hidden sm:inline'>推送下载</span>
                    <span className='sm:hidden'>下载</span>
                  </Button>
                }
              />
            </TooltipTrigger>
            <TooltipContent side='left' sideOffset={8}>
              <p>推送到下载器</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </Card>
  )
}
