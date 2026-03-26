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
        toast.success('Transfer config saved')
      }
    },
  })

  const testMutation = useMutation({
    mutationFn: async (payload: TransferTargetConfig) =>
      testTransferConnection(payload),
    onSuccess: (res) => {
      if (res.code === 0) {
        setLastResult('Target database connection succeeded')
        toast.success('Connection succeeded')
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
        toast.success('Target tables loaded')
      }
    },
  })

  const runMutation = useMutation({
    mutationFn: async () => runTransfer(),
    onSuccess: (res) => {
      if (res.code === 0 && res.data) {
        setLastResult(
          `Transfer completed: total ${res.data.total}, inserted ${res.data.inserted}, skipped ${res.data.skipped}`
        )
        toast.success('Transfer completed')
      }
    },
  })

  const targetLabel = useMemo(() => {
    if (!form.host || !form.database) {
      return 'Not configured'
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
              <h1 className='text-2xl font-bold'>Transfer Center</h1>
            </div>
            <p className='max-w-3xl text-sm text-muted-foreground'>
              Crawled data is written to the local main table first. This page
              copies data from `sht.article` into a table in another database.
            </p>
          </div>

          <Badge variant='outline'>Target DB: {targetLabel}</Badge>
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Database className='h-4 w-4' />
                Target Database
              </CardTitle>
              <CardDescription>
                Configure the external PostgreSQL database, then choose the
                target table.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Host</label>
                  <Input
                    value={form.host}
                    onChange={(event) => updateField('host', event.target.value)}
                  />
                </div>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Port</label>
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
                <label className='text-sm font-medium'>Database</label>
                <Input
                  value={form.database}
                  onChange={(event) =>
                    updateField('database', event.target.value)
                  }
                />
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Username</label>
                  <Input
                    value={form.username}
                    onChange={(event) =>
                      updateField('username', event.target.value)
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Password</label>
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
                  <label className='text-sm font-medium'>Target Table</label>
                  <Select
                    value={form.table || undefined}
                    onValueChange={(value) => updateField('table', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select table' />
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
                  {testMutation.isPending ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => tablesMutation.mutate(form)}
                  disabled={tablesMutation.isPending}
                >
                  {tablesMutation.isPending ? 'Loading...' : 'Load Tables'}
                </Button>
                <Button
                  type='button'
                  onClick={() => saveMutation.mutate(form)}
                  disabled={saveMutation.isPending}
                >
                  <Save />
                  {saveMutation.isPending ? 'Saving...' : 'Save Config'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Run Transfer</CardTitle>
              <CardDescription>
                Transfer reads from the local main table and appends data to the
                target table, skipping duplicate `(website, tid)` pairs.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-xl border p-4'>
                <div className='text-sm text-muted-foreground'>Current Target</div>
                <div className='mt-2 break-all font-mono text-sm'>
                  {form.schema || 'public'}.{form.table || '<no table selected>'}
                </div>
              </div>

              <div className='rounded-xl border p-4'>
                <div className='text-sm text-muted-foreground'>Flow</div>
                <div className='mt-2 space-y-1 text-sm'>
                  <p>1. Crawler writes to `sht.article` first.</p>
                  <p>2. Transfer copies data into the external target table.</p>
                  <p>3. Existing `(website, tid)` rows are skipped.</p>
                </div>
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  onClick={() => runMutation.mutate()}
                  disabled={runMutation.isPending}
                >
                  <ArrowRightLeft />
                  {runMutation.isPending ? 'Running...' : 'Start Transfer'}
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
