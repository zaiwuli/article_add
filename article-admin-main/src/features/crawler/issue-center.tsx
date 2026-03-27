import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FolderSearch,
  HardDriveDownload,
  PackageOpen,
  SearchCheck,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  downloadCrawlerIssue,
  getCrawlerIssues,
  ignoreCrawlerIssue,
  importCrawlerIssueOutputs,
  retryCrawlerIssue,
} from '@/api/crawler'
import type {
  CrawlerIssueItem,
} from '@/types/config'
import { ArticlePagination } from '@/features/articles/components/pagination'
import { CrawlerIssueCard } from '@/features/crawler/crawler-issue-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
    return '待人工处理'
  }
  if (status === 'downloaded') {
    return '已下载待导入'
  }
  if (status === 'ignored') {
    return '已忽略'
  }
  return '失败待处理'
}

function getIssueTypeLabel(issueType: string) {
  if (issueType === 'archive_detected') {
    return '压缩包附件'
  }
  if (issueType === 'detail_fetch_failed') {
    return '详情页抓取失败'
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
    return '检测到压缩包附件，需要先下载到监控目录，再由外部工具解压后导入。'
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
    return '压缩包附件已下载到监控目录，等待外部解压后再扫描导入。'
  }

  return reason || '暂无原因说明'
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
      toast.success('已重新探测该记录')
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const downloadMutation = useMutation({
    mutationFn: downloadCrawlerIssue,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      const count = res.data?.downloaded_files.length ?? 0
      toast.success(`已下载 ${count} 个附件，当前不会自动解压`)
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

  const items = data?.items ?? []

  const summary = useMemo(() => {
    const statusCount = {
      total: data?.total ?? 0,
      pendingManual: 0,
      downloaded: 0,
      ignored: 0,
    }

    for (const item of items) {
      if (item.status === 'pending_manual') {
        statusCount.pendingManual += 1
      } else if (item.status === 'downloaded') {
        statusCount.downloaded += 1
      } else if (item.status === 'ignored') {
        statusCount.ignored += 1
      }
    }

    return statusCount
  }, [data?.total, items])

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
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card className='border-dashed'>
          <CardContent className='p-5'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-sm text-muted-foreground'>当前异常总数</div>
                <div className='mt-2 text-2xl font-semibold'>{summary.total}</div>
              </div>
              <ShieldAlert className='h-6 w-6 text-primary' />
            </div>
          </CardContent>
        </Card>

        <Card className='border-dashed'>
          <CardContent className='p-5'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-sm text-muted-foreground'>待人工处理</div>
                <div className='mt-2 text-2xl font-semibold'>
                  {summary.pendingManual}
                </div>
              </div>
              <PackageOpen className='h-6 w-6 text-amber-600' />
            </div>
          </CardContent>
        </Card>

        <Card className='border-dashed'>
          <CardContent className='p-5'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-sm text-muted-foreground'>已下载待导入</div>
                <div className='mt-2 text-2xl font-semibold'>
                  {summary.downloaded}
                </div>
              </div>
              <HardDriveDownload className='h-6 w-6 text-sky-600' />
            </div>
          </CardContent>
        </Card>

        <Card className='border-dashed'>
          <CardContent className='p-5'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-sm text-muted-foreground'>自动解压状态</div>
                <div className='mt-2 text-lg font-semibold'>未上线</div>
              </div>
              <FolderSearch className='h-6 w-6 text-rose-500' />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className='border-dashed'>
        <CardHeader>
          <CardTitle className='text-base'>批量操作</CardTitle>
          <CardDescription>
            处理目录和附件处理流程已移动到“抓取配置”页，这里只保留抓取处理动作。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => batchDownloadMutation.mutate()}
              disabled={
                batchDownloadMutation.isPending || pendingArchiveIds.length === 0
              }
            >
              <HardDriveDownload className='h-4 w-4' />
              {batchDownloadMutation.isPending
                ? '批量下载中...'
                : '批量下载压缩包附件'}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
            >
              <SearchCheck className='h-4 w-4' />
              {importMutation.isPending ? '扫描中...' : '扫描解压输出'}
            </Button>
            <Badge variant='outline'>自动解压：未上线</Badge>
            <Badge variant='secondary'>待下载压缩包：{pendingArchiveIds.length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className='border-dashed'>
        <CardHeader>
          <CardTitle className='text-base'>筛选条件</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-[180px_180px_minmax(0,1fr)] xl:grid-cols-[180px_180px_minmax(0,1fr)]'>
          <div className='space-y-2'>
            <div className='text-sm font-medium'>状态</div>
            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1)
                setStatus(value)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部</SelectItem>
                <SelectItem value='failed'>失败待处理</SelectItem>
                <SelectItem value='pending_manual'>待人工处理</SelectItem>
                <SelectItem value='downloaded'>已下载待导入</SelectItem>
                <SelectItem value='ignored'>已忽略</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-medium'>类型</div>
            <Select
              value={issueType}
              onValueChange={(value) => {
                setPage(1)
                setIssueType(value)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部</SelectItem>
                <SelectItem value='archive_detected'>压缩包附件</SelectItem>
                <SelectItem value='resource_missing'>资源缺失</SelectItem>
                <SelectItem value='detail_fetch_failed'>详情页抓取失败</SelectItem>
                <SelectItem value='crawl_exception'>解析异常</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-medium'>关键词</div>
            <Input
              placeholder='按 tid、标题、板块或原因搜索'
              value={keyword}
              onChange={(event) => {
                setPage(1)
                setKeyword(event.target.value)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className='flex-1 overflow-y-auto'>
        <div className='grid gap-3'>
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
            <Card className='border-dashed'>
              <CardContent className='py-12 text-center text-sm text-muted-foreground'>
                当前没有待处理的抓取问题记录。
              </CardContent>
            </Card>
          )}
        </div>
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
