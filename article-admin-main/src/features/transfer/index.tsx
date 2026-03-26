import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, Database, PlugZap, Save } from 'lucide-react'
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

const DEFAULT_CONFIG: TransferTargetConfig = {
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
  schema: 'public',
  table: '',
}

export function TransferCenter() {
  const [form, setForm] = useState<TransferTargetConfig>(DEFAULT_CONFIG)
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

  useEffect(() => {
    if (!savedConfig) {
      return
    }
    setForm(savedConfig)
  }, [savedConfig])

  const saveMutation = useMutation({
    mutationFn: async (payload: TransferTargetConfig) =>
      saveTransferConfig(payload),
    onSuccess: (res) => {
      if (res.code === 0) {
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
          setForm((current) => ({ ...current, table: nextTables[0] }))
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

  const targetLabel = useMemo(() => {
    if (!form.host || !form.database) {
      return '未配置'
    }
    return `${form.host}:${form.port}/${form.database}`
  }, [form.database, form.host, form.port])

  const updateField = <K extends keyof TransferTargetConfig>(
    key: K,
    value: TransferTargetConfig[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
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
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <div className='flex items-center gap-3'>
              <ArrowRightLeft className='h-7 w-7 text-primary' />
              <h1 className='text-2xl font-bold'>转存中心</h1>
            </div>
            <p className='max-w-3xl text-sm text-muted-foreground'>
              爬虫会先把数据写入本地主资源表，这里再把 `sht.article`
              里的数据追加转存到其他数据库的目标表。
            </p>
          </div>

          <Badge variant='outline'>目标库：{targetLabel}</Badge>
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Database className='h-4 w-4' />
                目标数据库
              </CardTitle>
              <CardDescription>
                先配置外部 PostgreSQL 数据库，再选择要写入的目标表。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
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

              <div className='grid gap-4 md:grid-cols-2'>
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

              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Schema</label>
                  <Input
                    value={form.schema}
                    onChange={(event) => updateField('schema', event.target.value)}
                  />
                </div>
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
              </div>

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
                  onClick={() => saveMutation.mutate(form)}
                  disabled={saveMutation.isPending}
                >
                  <Save />
                  {saveMutation.isPending ? '保存中...' : '保存配置'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>执行转存</CardTitle>
              <CardDescription>
                转存会读取本地主资源表，再写入目标表；已存在的
                `(website, tid)` 数据会自动跳过。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-xl border p-4'>
                <div className='text-sm text-muted-foreground'>当前目标</div>
                <div className='mt-2 break-all font-mono text-sm'>
                  {form.schema || 'public'}.{form.table || '未选择目标表'}
                </div>
              </div>

              <div className='rounded-xl border p-4'>
                <div className='text-sm text-muted-foreground'>执行流程</div>
                <div className='mt-2 space-y-1 text-sm'>
                  <p>1. 爬虫先把数据写入 `sht.article`。</p>
                  <p>2. 转存功能再把数据追加到外部目标表。</p>
                  <p>3. 已存在的 `(website, tid)` 记录自动跳过。</p>
                </div>
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  onClick={() => runMutation.mutate()}
                  disabled={runMutation.isPending}
                >
                  <ArrowRightLeft />
                  {runMutation.isPending ? '转存中...' : '开始转存'}
                </Button>
              </div>

              {lastResult && (
                <div className='rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground'>
                  {lastResult}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
