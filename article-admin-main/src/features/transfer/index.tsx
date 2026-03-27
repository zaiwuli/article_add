import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Database,
  ExternalLink,
  PlugZap,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getTransferConfig,
  getTransferTables,
  runTransfer,
  saveTransferConfig,
  testTransferConnection,
} from '@/api/transfer'
import type { TransferTargetConfig } from '@/types/transfer'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
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
import { Switch } from '@/components/ui/switch'

const DEFAULT_CONFIG: TransferTargetConfig = {
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
  schema: 'public',
  table: '',
  schedule_enabled: false,
  schedule_cron: '0 2 * * *',
}

function getTargetLabel(form: TransferTargetConfig) {
  if (!form.host || !form.database) {
    return '未配置'
  }
  return `${form.host}:${form.port}/${form.database}`
}

export function TransferCenter() {
  const queryClient = useQueryClient()
  const [draftForm, setDraftForm] = useState<TransferTargetConfig | null>(null)
  const [tables, setTables] = useState<string[]>([])
  const [lastResult, setLastResult] = useState('')

  const { data: savedConfig } = useQuery({
    queryKey: ['transfer-config'],
    queryFn: async () => {
      const res = await getTransferConfig()
      return res.data ?? DEFAULT_CONFIG
    },
    staleTime: 60 * 1000,
  })

  const form = draftForm ?? savedConfig ?? DEFAULT_CONFIG
  const targetLabel = useMemo(() => getTargetLabel(form), [form])

  const saveMutation = useMutation({
    mutationFn: async (payload: TransferTargetConfig) =>
      saveTransferConfig(payload),
    onSuccess: (res, payload) => {
      if (res.code === 0) {
        queryClient.setQueryData(['transfer-config'], payload)
        setDraftForm(null)
        toast.success('转存配置已保存')
      }
    },
  })

  const testMutation = useMutation({
    mutationFn: async (payload: TransferTargetConfig) =>
      testTransferConnection(payload),
    onSuccess: (res) => {
      if (res.code === 0) {
        setLastResult('目标数据库连接成功')
        toast.success('连接测试成功')
      }
    },
  })

  const tablesMutation = useMutation({
    mutationFn: async (payload: TransferTargetConfig) =>
      getTransferTables(payload),
    onSuccess: (res) => {
      if (res.code === 0) {
        const nextTables = res.data?.tables ?? []
        setTables(nextTables)
        if (nextTables.length > 0 && !nextTables.includes(form.table)) {
          setDraftForm((current) => ({
            ...(current ?? savedConfig ?? DEFAULT_CONFIG),
            table: nextTables[0],
          }))
        }
        toast.success('目标数据表已加载')
      }
    },
  })

  const runMutation = useMutation({
    mutationFn: async () => runTransfer(),
    onSuccess: (res) => {
      if (res.code === 0 && res.data) {
        setLastResult(
          `转存完成：总计 ${res.data.total} 条，新增 ${res.data.inserted} 条，跳过 ${res.data.skipped} 条`
        )
        toast.success('转存完成')
      }
    },
  })

  const updateField = <K extends keyof TransferTargetConfig>(
    key: K,
    value: TransferTargetConfig[K]
  ) => {
    setDraftForm((current) => ({
      ...(current ?? savedConfig ?? DEFAULT_CONFIG),
      [key]: value,
    }))
  }

  const handleSave = () => {
    saveMutation.mutate(form)
  }

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ImageModeSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
        </div>
      </Header>

      <Main className='flex h-[calc(100vh-4rem)] flex-col gap-4'>
        <div className='flex items-center justify-between rounded-2xl border p-4 shadow-sm'>
          <div className='flex items-center gap-3'>
            <ArrowRightLeft className='h-6 w-6 text-primary' />
            <h1 className='text-2xl font-bold'>转存中心</h1>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>目标库：{targetLabel}</Badge>
            <Badge variant='outline'>
              自动转存：{form.schedule_enabled ? '已开启' : '已关闭'}
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader className='border-b'>
            <div className='flex items-center justify-between gap-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Database className='h-4 w-4' />
                目标连接配置
              </CardTitle>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => testMutation.mutate(form)}
                  disabled={testMutation.isPending}
                >
                  <PlugZap />
                  {testMutation.isPending ? '测试中...' : '测试连接'}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => tablesMutation.mutate(form)}
                  disabled={tablesMutation.isPending}
                >
                  {tablesMutation.isPending ? '加载中...' : '读取数据表'}
                </Button>
                <Button
                  type='button'
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  <Save />
                  {saveMutation.isPending ? '保存中...' : '保存配置'}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className='space-y-5 p-5'>
            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>主机地址</label>
                <Input
                  value={form.host}
                  onChange={(event) => updateField('host', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>端口</label>
                <Input
                  type='number'
                  value={form.port}
                  onChange={(event) =>
                    updateField('port', Number(event.target.value) || 5432)
                  }
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>数据库名</label>
                <Input
                  value={form.database}
                  onChange={(event) =>
                    updateField('database', event.target.value)
                  }
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Schema</label>
                <Input
                  value={form.schema}
                  onChange={(event) => updateField('schema', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>用户名</label>
                <Input
                  value={form.username}
                  onChange={(event) =>
                    updateField('username', event.target.value)
                  }
                />
              </div>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>密码</label>
                <Input
                  type='password'
                  value={form.password}
                  onChange={(event) =>
                    updateField('password', event.target.value)
                  }
                />
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>目标表</label>
                <Select
                  value={form.table || undefined}
                  onValueChange={(value) => updateField('table', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='请选择目标表' />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center justify-between rounded-xl border px-4 py-3'>
                <div className='space-y-1'>
                  <div className='text-sm font-medium'>自动转存</div>
                  <div className='text-xs text-muted-foreground'>开关</div>
                </div>
                <Switch
                  checked={form.schedule_enabled}
                  onCheckedChange={(checked) =>
                    updateField('schedule_enabled', checked)
                  }
                  disabled={saveMutation.isPending}
                />
              </div>
            </div>

            <div className='space-y-2 border-t pt-5'>
              <label className='text-sm font-medium'>Cron 时间</label>
              <Input
                value={form.schedule_cron}
                placeholder='0 2 * * *'
                onChange={(event) =>
                  updateField('schedule_cron', event.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]'>
          <Card>
            <CardHeader className='border-b'>
              <CardTitle className='text-base'>执行结果</CardTitle>
            </CardHeader>
            <CardContent className='p-5'>
              <div className='min-h-16 whitespace-pre-wrap text-sm text-muted-foreground'>
                {lastResult || '还没有执行记录。'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='border-b'>
              <CardTitle className='text-base'>操作</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-2 p-5'>
              <Button
                type='button'
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending}
              >
                <ArrowRightLeft />
                {runMutation.isPending ? '转存中...' : '开始转存'}
              </Button>
              <Button variant='outline' asChild>
                <Link to='/logs'>
                  查看日志
                  <ExternalLink />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
