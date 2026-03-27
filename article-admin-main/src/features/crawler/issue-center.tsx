import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Download,
  ExternalLink,
  FolderOpen,
  RefreshCcw,
  RefreshCw,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { getConfig, postConfig } from '@/api/config'
import {
  downloadCrawlerIssue,
  getCrawlerIssues,
  ignoreCrawlerIssue,
  importCrawlerIssueOutputs,
  retryCrawlerIssue,
} from '@/api/crawler'
import type {
  CrawlerIssueHandlingConfig,
  CrawlerIssueItem,
} from '@/types/config'
import { ArticlePagination } from '@/features/articles/components/pagination.tsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
    return '压缩包'
  }
  if (issueType === 'detail_fetch_failed') {
    return '页面拉取失败'
  }
  if (issueType === 'crawl_exception') {
    return '解析异常'
  }
  return '资源缺失'
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

function summarizeAttachments(issue: CrawlerIssueItem) {
  if (!issue.attachment_names.length) {
    return '-'
  }
  return issue.attachment_names.join(' / ')
}

export function CrawlerIssueCenter() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [issueType, setIssueType] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [pathForm, setPathForm] = useState<CrawlerIssueHandlingConfig | null>(null)

  const { data: pathConfig } = useQuery({
    queryKey: ['crawler-issue-config'],
    queryFn: async () => {
      const res = await getConfig<CrawlerIssueHandlingConfig>('CrawlerIssueHandling')
      return (
        res.data ?? {
          watch_path: '',
          output_path: '',
        }
      )
    },
    staleTime: 5 * 60 * 1000,
  })

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

  const currentPathForm =
    pathForm ??
    pathConfig ?? {
      watch_path: '',
      output_path: '',
    }

  const savePathMutation = useMutation({
    mutationFn: async (payload: CrawlerIssueHandlingConfig) =>
      postConfig('CrawlerIssueHandling', payload),
    onSuccess: (res, payload) => {
      if (res.code !== 0) {
        return
      }
      toast.success('处理目录已保存')
      setPathForm(payload)
      queryClient.setQueryData(['crawler-issue-config'], payload)
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const retryMutation = useMutation({
    mutationFn: retryCrawlerIssue,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      toast.success('已重新探测')
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const downloadMutation = useMutation({
    mutationFn: downloadCrawlerIssue,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      toast.success(`已下载 ${res.data?.downloaded_files.length ?? 0} 个附件`)
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const ignoreMutation = useMutation({
    mutationFn: ignoreCrawlerIssue,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      toast.success('已忽略该记录')
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: importCrawlerIssueOutputs,
    onSuccess: (res) => {
      if (res.code !== 0) {
        return
      }
      toast.success(
        `已导入 ${res.data?.imported ?? 0} 条，跳过 ${res.data?.skipped.length ?? 0} 条`
      )
      queryClient.invalidateQueries({ queryKey: ['crawler-issues'] })
    },
  })

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 xl:grid-cols-[1.2fr_2fr]'>
        <Card>
          <CardHeader className='border-b'>
            <CardTitle className='text-base'>处理目录</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 p-5'>
            <div className='space-y-2'>
              <p className='text-sm font-medium'>监控目录</p>
              <Input
                value={currentPathForm.watch_path}
                onChange={(event) =>
                  setPathForm({
                    ...currentPathForm,
                    watch_path: event.target.value,
                  })
                }
              />
            </div>
            <div className='space-y-2'>
              <p className='text-sm font-medium'>输出目录</p>
              <Input
                value={currentPathForm.output_path}
                onChange={(event) =>
                  setPathForm({
                    ...currentPathForm,
                    output_path: event.target.value,
                  })
                }
              />
            </div>
            <Button
              type='button'
              onClick={() => savePathMutation.mutate(currentPathForm)}
              disabled={savePathMutation.isPending}
              className='w-full'
            >
              <Save className='h-4 w-4' />
              {savePathMutation.isPending ? '保存中...' : '保存目录配置'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='border-b'>
            <CardTitle className='text-base'>抓取处理</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 p-5'>
            <div className='grid gap-4 md:grid-cols-[180px_180px_minmax(0,1fr)_auto]'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>状态</p>
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
                    <SelectItem value='failed'>失败</SelectItem>
                    <SelectItem value='pending_manual'>待处理</SelectItem>
                    <SelectItem value='downloaded'>已下载</SelectItem>
                    <SelectItem value='ignored'>已忽略</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <p className='text-sm font-medium'>类型</p>
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
                    <SelectItem value='archive_detected'>压缩包</SelectItem>
                    <SelectItem value='resource_missing'>资源缺失</SelectItem>
                    <SelectItem value='detail_fetch_failed'>页面失败</SelectItem>
                    <SelectItem value='crawl_exception'>解析异常</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <p className='text-sm font-medium'>关键词</p>
                <Input
                  placeholder='按 tid、标题、版块或原因搜索'
                  value={keyword}
                  onChange={(event) => {
                    setPage(1)
                    setKeyword(event.target.value)
                  }}
                />
              </div>

              <div className='flex items-end gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                >
                  <RefreshCw className='h-4 w-4' />
                  {importMutation.isPending ? '扫描中...' : '扫描解压输出'}
                </Button>
              </div>
            </div>

            <div className='flex items-center justify-between rounded-2xl border px-4 py-3'>
              <div className='space-y-1'>
                <p className='text-sm font-medium'>当前问题数</p>
                <p className='text-xs text-muted-foreground'>
                  共 {data?.total ?? 0} 条，扫描按钮会把解压后的 `txt/torrent/nfo`
                  自动导入正常资源表。
                </p>
              </div>
              <Badge variant='outline'>{data?.total ?? 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='overflow-hidden rounded-2xl border shadow-sm'>
        <Table>
          <TableHeader className='hidden md:table-header-group'>
            <TableRow>
              <TableHead>资源</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>附件</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((issue) => (
              <TableRow
                key={issue.id}
                className='group flex flex-col border-b p-4 transition-colors md:table-row md:p-0'
              >
                <TableCell className='space-y-2 p-0 pb-3 md:table-cell md:py-4'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-sm font-semibold'>
                      {issue.title || `tid=${issue.tid}`}
                    </span>
                    <Badge variant='secondary'>{issue.section}</Badge>
                    <Badge variant='outline'>{issue.website}</Badge>
                  </div>
                  <div className='space-y-1 text-xs text-muted-foreground'>
                    <p>tid: {issue.tid}</p>
                    <p className='break-all'>{issue.detail_url}</p>
                  </div>
                </TableCell>

                <TableCell className='flex items-start justify-between px-0 py-2 md:table-cell md:py-4'>
                  <span className='text-sm font-medium text-muted-foreground md:hidden'>
                    状态
                  </span>
                  <div className='flex flex-wrap gap-2'>
                    <Badge
                      variant='outline'
                      className={getStatusBadgeClass(issue.status)}
                    >
                      {getStatusLabel(issue.status)}
                    </Badge>
                    <Badge variant='outline'>{getIssueTypeLabel(issue.issue_type)}</Badge>
                    {issue.retry_count > 0 && (
                      <Badge variant='outline'>重试 {issue.retry_count}</Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className='flex items-start justify-between px-0 py-2 md:table-cell md:py-4'>
                  <span className='text-sm font-medium text-muted-foreground md:hidden'>
                    原因
                  </span>
                  <div className='max-w-[520px] space-y-1 text-right md:text-left'>
                    <p className='text-sm'>
                      {issue.reason_message || issue.reason_code || '-'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {issue.stage || '-'}
                    </p>
                  </div>
                </TableCell>

                <TableCell className='flex items-start justify-between px-0 py-2 md:table-cell md:py-4'>
                  <span className='text-sm font-medium text-muted-foreground md:hidden'>
                    附件
                  </span>
                  <div className='max-w-[320px] space-y-1 text-right md:text-left'>
                    <p className='text-sm'>{summarizeAttachments(issue)}</p>
                    <p className='text-xs text-muted-foreground'>
                      {issue.attachment_types.join(', ') || '-'}
                    </p>
                  </div>
                </TableCell>

                <TableCell className='flex justify-end px-0 pt-3 md:table-cell md:pt-4'>
                  <div className='flex w-full flex-wrap justify-end gap-2 border-t pt-3 md:w-auto md:border-none md:pt-0'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      asChild
                    >
                      <a
                        href={issue.detail_url}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        <ExternalLink className='h-4 w-4' />
                        打开帖子
                      </a>
                    </Button>

                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => retryMutation.mutate(issue.id)}
                      disabled={retryMutation.isPending}
                    >
                      <RefreshCcw className='h-4 w-4' />
                      重新探测
                    </Button>

                    {issue.issue_type === 'archive_detected' && (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => downloadMutation.mutate(issue.id)}
                        disabled={downloadMutation.isPending}
                      >
                        <Download className='h-4 w-4' />
                        下载到监控目录
                      </Button>
                    )}

                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => ignoreMutation.mutate(issue.id)}
                      disabled={ignoreMutation.isPending}
                    >
                      <Ban className='h-4 w-4' />
                      忽略
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='py-10 text-center text-sm text-muted-foreground'
                >
                  <div className='inline-flex items-center gap-2'>
                    <FolderOpen className='h-4 w-4' />
                    当前没有待处理记录
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
