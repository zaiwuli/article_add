import { useState } from 'react'
import type { ArticleMultiValue } from '@/types/article'
import type { CrawlerIssueItem } from '@/types/config'
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileArchive,
  Image as ImageIcon,
  RefreshCcw,
} from 'lucide-react'
import { useImageMode } from '@/context/image-mode-provider.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ResponsiveModal } from '@/components/response-modal'

function normalizeList(value?: ArticleMultiValue | null): string[] {
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

interface CrawlerIssueCardProps {
  issue: CrawlerIssueItem
  statusLabel: string
  issueTypeLabel: string
  stageLabel: string
  reasonText: string
  statusClassName: string
  retryPending?: boolean
  downloadPending?: boolean
  ignorePending?: boolean
  onRetry: (issueId: number) => void
  onDownload: (issueId: number) => void
  onIgnore: (issueId: number) => void
}

export function CrawlerIssueCard({
  issue,
  statusLabel,
  issueTypeLabel,
  stageLabel,
  reasonText,
  statusClassName,
  retryPending = false,
  downloadPending = false,
  ignorePending = false,
  onRetry,
  onDownload,
  onIgnore,
}: CrawlerIssueCardProps) {
  const { mode } = useImageMode()
  const images = normalizeList(issue.preview_images)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const activeImage = images[currentIndex] || images[0] || ''
  const attachments = issue.attachment_names.length
    ? issue.attachment_names.join(' / ')
    : '无附件信息'

  const nextImage = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  return (
    <Card className='group relative flex w-full max-w-full flex-col gap-3 overflow-hidden rounded-xl p-3 transition-all duration-300 hover:shadow-lg sm:flex-row'>
      <div className='absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-sky-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />

      <ResponsiveModal
        title='图片预览'
        trigger={
          <div className='relative h-40 w-full overflow-hidden rounded-lg sm:h-32 sm:w-48 sm:flex-shrink-0'>
            {!imageError && images.length > 0 ? (
              <>
                <img
                  src={images[0]}
                  alt={issue.title || `tid-${issue.tid}`}
                  className={`h-full w-full cursor-zoom-in object-cover transition-all duration-500 group-hover:scale-105 ${
                    mode === 'blur' ? 'blur-md' : ''
                  }`}
                  onError={() => setImageError(true)}
                />
                <div className='absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
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
        }
      >
        <div className='relative w-auto max-w-[95vw] rounded-lg bg-black/95 p-4 sm:max-w-none'>
          <img
            src={activeImage}
            alt={`${issue.title || `tid-${issue.tid}`}-${currentIndex}`}
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
      </ResponsiveModal>

      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          <Badge variant='secondary'>{issue.section}</Badge>
          {issue.category && <Badge variant='outline'>{issue.category}</Badge>}
          <Badge variant='outline' className={statusClassName}>
            {statusLabel}
          </Badge>
          <Badge variant='outline'>{issueTypeLabel}</Badge>
          {issue.publish_date && (
            <span className='text-muted-foreground'>{issue.publish_date}</span>
          )}
          {issue.size && (
            <span className='rounded-full bg-muted px-2.5 py-1 font-medium'>
              {issue.size} MB
            </span>
          )}
        </div>

        <div className='space-y-2'>
          <h6 className='break-words text-sm font-semibold leading-snug sm:text-[15px]'>
            {issue.title || `tid=${issue.tid}`}
          </h6>
          <p className='text-sm text-muted-foreground'>{reasonText}</p>
          <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            <span className='rounded-full border px-2.5 py-1'>{issue.website}</span>
            <span className='rounded-full border px-2.5 py-1'>{stageLabel}</span>
            {issue.retry_count > 0 && (
              <span className='rounded-full border px-2.5 py-1'>
                重试 {issue.retry_count}
              </span>
            )}
          </div>
        </div>

        <div className='rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground'>
          <div className='mb-1 flex items-center gap-2 font-medium text-foreground'>
            <FileArchive className='h-4 w-4' />
            附件
          </div>
          <p className='break-words'>{attachments}</p>
        </div>

        <div className='text-xs text-muted-foreground'>
          <div>tid：{issue.tid}</div>
          <div className='break-all'>详情页：{issue.detail_url}</div>
        </div>
      </div>

      <div className='flex w-full flex-wrap gap-2 sm:w-auto sm:max-w-[164px] sm:flex-col sm:justify-center'>
        <Button type='button' variant='outline' size='sm' asChild>
          <a href={issue.detail_url} target='_blank' rel='noopener noreferrer'>
            <ExternalLink className='h-4 w-4' />
            打开帖子
          </a>
        </Button>

        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => onRetry(issue.id)}
          disabled={retryPending}
        >
          <RefreshCcw className='h-4 w-4' />
          重新探测
        </Button>

        {issue.issue_type === 'archive_detected' && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => onDownload(issue.id)}
            disabled={downloadPending}
          >
            <Download className='h-4 w-4' />
            {issue.status === 'downloaded' ? '重新下载附件' : '下载附件'}
          </Button>
        )}

        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => onIgnore(issue.id)}
          disabled={ignorePending}
        >
          <Ban className='h-4 w-4' />
          忽略
        </Button>
      </div>
    </Card>
  )
}
