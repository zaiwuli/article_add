import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  HardDriveDownload,
  Play,
  SearchCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  downloadCrawlerIssue,
  getCrawlerIssues,
  ignoreCrawlerIssue,
  importCrawlerIssueOutputs,
  processCrawlerIssuesAuto,
  retryCrawlerIssue,
} from '@/api/crawler'
import type { CrawlerIssueItem } from '@/types/config'
import { ArticlePagination } from '@/features/articles/components/pagination'
import { CrawlerIssueCard } from '@/features/crawler/crawler-issue-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ISSUE_PAGE_SIZE = 20

function getStatusLabel(status: string) {
  if (status === 'pending_manual') {
    return '待处理'
  }
  if (status === 'downloaded') {
    return '已下载'
  }
  if (status === 'ignored') {
    return '已忽略'
  }
  return '失败'
}

function getIssueTypeLabel(issueType: string) {
  if (issueType === 'archive_detected') {
    return '压缩包附件'
  }
  if (issueType === 'detail_fetch_failed') {
    return '详情抓取失败'
  }
  if (issueType === 'crawl_exception') {
    return '解析异常'
  }
  return '资源缺失'
}

function getStageLabel(stage?: string | null) {
  if (stage === 'detail_fetch') {
    return '详情抓取'
  }
  if (stage === 'resource_parse') {
    return '资源解析'
  }
  if (stage === 'detail_parse') {
    return '详情解析'
  }
  return '未知阶段'
}

function getStatusBadgeClass(status: string) {
  if (status === 'pending_manual') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (status === 'downloaded') {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }
  if (status === 'ignored') {
    return 'border-slate-200 bg-slate-100 text-slate-600'
  }
  return 'border-rose-200 bg-rose-50 text-rose-700'
}

function getReasonText(issue: CrawlerIssueItem) {
  const code = issue.reason_code || ''
  const reason = (issue.reason_message || '').trim()

  if (code === 'archive_detected') {
    return '检测到压缩包附件，可直接执行自动处理或手动下载。'
  }
  if (code === 'detail_fetch_failed') {
    return '详情页抓取失败，当前没有拿到可解析的页面内容。'
  }
  if (code === 'download_resource_missing') {
    if (reason.includes('解析文本附件失败')) {
      return reason
    }
    return '未找到可直接入库的磁力、ED2K 或可解析附件。'
  }
  if (code === 'crawl_detail_exception') {
    if (reason.startsWith('详情解析异常')) {
      return reason
    }
    return reason ? `详情解析异常：${reason}` : '详情解析过程中发生异常。'
  }

  if (reason === 'archive attachments require external processing') {
    return '检测到压缩包附件，需要先下载到监控目录，再由外部工具解压后导入。'
  }
  if (reason === 'failed to load detail html') {
    return '详情页抓取失败，当前没有拿到可解析的页面内容。'
  }
  if (reason === 'no supported download resource found') {
    return '未找到可直接入库的磁力、ED2K 或可解析附件。'
  }
  if (reason.startsWith('downloaded ')) {
    return '压缩包附件已下载到监控目录，等待后续处理。'
  }

  return reason || '暂无原因说明'
}

function SummaryBadge({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'warn' | 'info' | 'success'
}) {
  const toneClass =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'info'
        ? 'border-sky-200 bg-sky-50'
        : tone === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-border bg-muted/30'

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <div className='text-[11px] text-muted-foreground'>{label}</div>
      <div className='mt-1 text-base font-semibold leading-none'>{value}</div>
    </div>
  )
}

export function CrawlerIssueCenter() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [issueType, setIssueType] = useState('all')
  const [keyword, setKeyword] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crawler-issues', page, status, issueType, keyword],
    queryFn: async () => {
      const res = await getCrawlerIssues({
        page,
        perPage: ISSUE_PAGE_SIZE,
        status,
        issueType,
        keyword,
      })
      return res.data
    },
  })

  const retryMutation = useMutation({
    mutationFn: retryCrawlerIssue,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      toast.success(res.message || '已重新探测该记录')
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const downloadMutation = useMutation({
    mutationFn: downloadCrawlerIssue,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      const autoImported = res.data?.auto_process?.imported ?? 0
      if (autoImported > 0) {
        toast.success(`已自动下载、解压并导入 ${autoImported} 条资源`)
      } else {
        const count = res.data?.downloaded_files.length ?? 0
        toast.success(`已下载 ${count} 个附件`)
      }
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const ignoreMutation = useMutation({
    mutationFn: ignoreCrawlerIssue,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      toast.success('该记录已忽略')
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: importCrawlerIssueOutputs,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      const imported = res.data?.imported ?? 0
      const skipped = res.data?.skipped.length ?? 0
      toast.success(`已导入 ${imported} 条，跳过 ${skipped} 条`)
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const autoProcessMutation = useMutation({
    mutationFn: () => processCrawlerIssuesAuto(),
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      const data = res.data
      toast.success(
        `已处理 ${data?.total ?? 0} 条，导入 ${data?.imported ?? 0} 条，失败 ${data?.failed ?? 0} 条`
      )
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const items = data?.items ?? []
  const summary = data?.summary ?? {
    total: 0,
    failed: 0,
    pending_manual: 0,
    downloaded: 0,
    ignored: 0,
  }
  const autoExtract = data?.auto_extract

  const pendingArchiveIds = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.status === 'pending_manual' &&
            item.issue_type === 'archive_detected'
        )
        .map((item) => item.id),
    [items]
  )

  const batchDownloadMutation = useMutation({
    mutationFn: async () => {
      let fileCount = 0
      for (const issueId of pendingArchiveIds) {
        const res = await downloadCrawlerIssue(issueId)
        if (res.code === 0) {
          fileCount += res.data?.downloaded_files.length ?? 0
        }
      }
      return {
        issueCount: pendingArchiveIds.length,
        fileCount,
      }
    },
    onSuccess: ({ issueCount, fileCount }) => {
      if (issueCount === 0) {
        toast.info('当前没有待下载的压缩包附件')
        return
      }
      toast.success(`已批量下载 ${issueCount} 条记录，共 ${fileCount} 个附件`)
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  return (
    <div className='space-y-4'>
      <Card className='border-dashed'>
        <CardContent className='space-y-3 p-4'>
          <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
            <SummaryBadge label='异常总数' value={summary.total} />
            <SummaryBadge label='失败待处理' value={summary.failed} tone='warn' />
            <SummaryBadge label='待下载' value={summary.pending_manual} tone='info' />
            <SummaryBadge label='已下载待导入' value={summary.downloaded} tone='success' />
            <SummaryBadge
              label='自动解压'
              value={autoExtract?.enabled ? '已开启' : '已关闭'}
              tone={autoExtract?.enabled ? 'success' : 'default'}
            />
          </div>

          <div className='grid gap-2 xl:grid-cols-[140px_160px_minmax(0,1fr)_auto_auto_auto]'>
            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1)
                setStatus(value)
              }}
            >
              <SelectTrigger className='h-9'>
                <SelectValue placeholder='状态' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部状态</SelectItem>
                <SelectItem value='failed'>失败待处理</SelectItem>
                <SelectItem value='pending_manual'>待人工处理</SelectItem>
                <SelectItem value='downloaded'>已下载待导入</SelectItem>
                <SelectItem value='ignored'>已忽略</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={issueType}
              onValueChange={(value) => {
                setPage(1)
                setIssueType(value)
              }}
            >
              <SelectTrigger className='h-9'>
                <SelectValue placeholder='类型' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部类型</SelectItem>
                <SelectItem value='archive_detected'>压缩包附件</SelectItem>
                <SelectItem value='resource_missing'>资源缺失</SelectItem>
                <SelectItem value='detail_fetch_failed'>详情抓取失败</SelectItem>
                <SelectItem value='crawl_exception'>解析异常</SelectItem>
              </SelectContent>
            </Select>

            <Input
              className='h-9'
              placeholder='搜索 tid、标题、板块或原因'
              value={keyword}
              onChange={(event) => {
                setPage(1)
                setKeyword(event.target.value)
              }}
            />

            <Button
              type='button'
              size='sm'
              className='h-9'
              onClick={() => autoProcessMutation.mutate()}
              disabled={autoProcessMutation.isPending}
            >
              <Play className='h-4 w-4' />
              {autoProcessMutation.isPending ? '处理中...' : '立即处理一次'}
            </Button>

            <Button
              type='button'
              size='sm'
              variant='outline'
              className='h-9'
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
            >
              <SearchCheck className='h-4 w-4' />
              {importMutation.isPending ? '扫描中...' : '仅扫描导入'}
            </Button>

            <Button
              type='button'
              size='sm'
              variant='outline'
              className='h-9'
              onClick={() => batchDownloadMutation.mutate()}
              disabled={
                batchDownloadMutation.isPending || pendingArchiveIds.length === 0
              }
            >
              <HardDriveDownload className='h-4 w-4' />
              {batchDownloadMutation.isPending ? '下载中...' : '批量下载'}
            </Button>
          </div>

          <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            <Badge variant='outline'>
              <ShieldAlert className='mr-1 h-3.5 w-3.5' />
              定时处理：{autoExtract?.schedule_enabled ? '已开启' : '已关闭'}
            </Badge>
            <Badge variant='outline'>
              <Sparkles className='mr-1 h-3.5 w-3.5' />
              待下载压缩包：{pendingArchiveIds.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-3 xl:grid-cols-2'>
        {items.map((issue) => (
          <CrawlerIssueCard
            key={issue.id}
            issue={issue}
            statusLabel={getStatusLabel(issue.status)}
            issueTypeLabel={getIssueTypeLabel(issue.issue_type)}
            stageLabel={getStageLabel(issue.stage)}
            reasonText={getReasonText(issue)}
            statusClassName={getStatusBadgeClass(issue.status)}
            retryPending={retryMutation.isPending}
            downloadPending={downloadMutation.isPending}
            ignorePending={ignoreMutation.isPending}
            onRetry={(issueId) => retryMutation.mutate(issueId)}
            onDownload={(issueId) => downloadMutation.mutate(issueId)}
            onIgnore={(issueId) => ignoreMutation.mutate(issueId)}
          />
        ))}

        {!isLoading && items.length === 0 && (
          <Card className='border-dashed xl:col-span-2'>
            <CardContent className='py-10 text-center text-sm text-muted-foreground'>
              当前没有待处理的抓取问题记录。
            </CardContent>
          </Card>
        )}
      </div>

      <div className='flex shrink-0 pt-1'>
        <ArticlePagination
          page={page}
          total={data?.total || 0}
          pageSize={ISSUE_PAGE_SIZE}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
