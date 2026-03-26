import { useEffect, useMemo, useState } from 'react'
import Axios from 'axios'
import {
  Braces,
  Copy,
  Send,
  Server,
  Settings2,
  Shield,
  Waypoints,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
type BodyType = 'json' | 'form'

type ApiPreset = {
  label: string
  description: string
  method: HttpMethod
  path: string
  auth: boolean
  bodyType: BodyType
  body: string
}

const STORAGE_KEY = 'api-center-settings'
const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const API_PRESETS: ApiPreset[] = [
  {
    label: '公开分类',
    description: '读取资源分类统计',
    method: 'GET',
    path: '/public/articles/categories',
    auth: false,
    bodyType: 'json',
    body: '',
  },
  {
    label: '公开检索',
    description: '按条件查询资源数据',
    method: 'POST',
    path: '/public/articles/search',
    auth: false,
    bodyType: 'json',
    body: '{\n  "page": 1,\n  "per_page": 20,\n  "keyword": ""\n}',
  },
  {
    label: '任务函数',
    description: '读取可执行的任务函数列表',
    method: 'GET',
    path: '/tasks/functions',
    auth: true,
    bodyType: 'json',
    body: '',
  },
  {
    label: '爬虫模块',
    description: '读取爬虫模块配置',
    method: 'GET',
    path: '/config/CrawlerSections',
    auth: true,
    bodyType: 'json',
    body: '',
  },
  {
    label: '运行配置',
    description: '读取代理和 FlareSolverR 配置',
    method: 'GET',
    path: '/config/CrawlerRuntime',
    auth: true,
    bodyType: 'json',
    body: '',
  },
  {
    label: '日志文件',
    description: '读取日志文件清单',
    method: 'GET',
    path: '/logs/files',
    auth: true,
    bodyType: 'json',
    body: '',
  },
]

function getStoredSettings() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as {
      baseUrl?: string
      useAccessToken?: boolean
      useCustomToken?: boolean
      customToken?: string
      method?: HttpMethod
      bodyType?: BodyType
      path?: string
      body?: string
    }
  } catch {
    return null
  }
}

function buildRequestUrl(baseUrl: string, path: string) {
  const normalizedPath = path.trim()
  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath
  }

  const normalizedBase = baseUrl.trim().replace(/\/+$/, '')
  const normalizedRelativePath = normalizedPath.replace(/^\/+/, '')

  if (!normalizedBase) {
    return `/${normalizedRelativePath}`
  }
  return `${normalizedBase}/${normalizedRelativePath}`
}

function formatJson(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value ?? '')
  }
}

function createFormPayload(body: string) {
  const trimmedBody = body.trim()
  if (!trimmedBody) {
    return ''
  }

  try {
    const parsed = JSON.parse(trimmedBody) as Record<string, unknown>
    const params = new URLSearchParams()
    Object.entries(parsed).forEach(([key, value]) => {
      params.append(key, value == null ? '' : String(value))
    })
    return params.toString()
  } catch {
    return trimmedBody
  }
}

export function ApiCenter() {
  const storedSettings = getStoredSettings()
  const {
    auth: { accessToken },
  } = useAuthStore()

  const [baseUrl, setBaseUrl] = useState(
    storedSettings?.baseUrl || DEFAULT_BASE_URL
  )
  const [useAccessToken, setUseAccessToken] = useState(
    storedSettings?.useAccessToken ?? true
  )
  const [useCustomToken, setUseCustomToken] = useState(
    storedSettings?.useCustomToken ?? false
  )
  const [customToken, setCustomToken] = useState(storedSettings?.customToken || '')
  const [method, setMethod] = useState<HttpMethod>(
    storedSettings?.method || 'GET'
  )
  const [bodyType, setBodyType] = useState<BodyType>(
    storedSettings?.bodyType || 'json'
  )
  const [path, setPath] = useState(
    storedSettings?.path || '/public/articles/categories'
  )
  const [body, setBody] = useState(storedSettings?.body || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [responseStatus, setResponseStatus] = useState<number>()
  const [responseTime, setResponseTime] = useState<number>()
  const [responseText, setResponseText] = useState('')
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>(
    {}
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        baseUrl,
        useAccessToken,
        useCustomToken,
        customToken,
        method,
        bodyType,
        path,
        body,
      })
    )
  }, [
    baseUrl,
    useAccessToken,
    useCustomToken,
    customToken,
    method,
    bodyType,
    path,
    body,
  ])

  const resolvedUrl = useMemo(
    () => buildRequestUrl(baseUrl, path),
    [baseUrl, path]
  )

  const activeToken = useMemo(() => {
    if (useCustomToken) {
      return customToken.trim()
    }
    if (useAccessToken) {
      return accessToken?.trim()
    }
    return ''
  }, [accessToken, customToken, useAccessToken, useCustomToken])

  const handleUsePreset = (preset: ApiPreset) => {
    setMethod(preset.method)
    setPath(preset.path)
    setUseAccessToken(preset.auth)
    setUseCustomToken(false)
    setBodyType(preset.bodyType)
    setBody(preset.body)
  }

  const handleCopyResponse = async () => {
    try {
      await navigator.clipboard.writeText(responseText)
      toast.success('响应内容已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleSendRequest = async () => {
    if (!path.trim()) {
      toast.error('请输入接口路径')
      return
    }

    if (useAccessToken && !useCustomToken && !accessToken) {
      toast.error('当前没有可用的登录令牌')
      return
    }

    setIsSubmitting(true)
    const start = performance.now()

    try {
      const headers: Record<string, string> = {}
      let data: unknown

      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`
      }

      if (method !== 'GET' && method !== 'DELETE') {
        if (bodyType === 'json') {
          headers['Content-Type'] = 'application/json'
          data = body.trim() ? JSON.parse(body) : undefined
        } else {
          headers['Content-Type'] = 'application/x-www-form-urlencoded'
          data = createFormPayload(body)
        }
      }

      const response = await Axios.request({
        url: resolvedUrl,
        method,
        headers,
        data,
        timeout: 15000,
        validateStatus: () => true,
      })

      const end = performance.now()
      setResponseStatus(response.status)
      setResponseTime(Math.round(end - start))
      setResponseHeaders(
        Object.fromEntries(
          Object.entries(response.headers ?? {}).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(', ') : String(value),
          ])
        )
      )
      setResponseText(formatJson(response.data))
      toast.success('接口调用完成')
    } catch (error) {
      const end = performance.now()
      setResponseStatus(undefined)
      setResponseTime(Math.round(end - start))
      setResponseHeaders({})
      setResponseText(
        formatJson({
          message: error instanceof Error ? error.message : 'request failed',
        })
      )
      toast.error('接口调用失败')
    } finally {
      setIsSubmitting(false)
    }
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
              <Waypoints className='h-7 w-7 text-primary' />
              <h1 className='text-2xl font-bold'>API 中心</h1>
            </div>
            <p className='max-w-3xl text-sm text-muted-foreground'>
              在页面里直接调用当前系统接口。支持设置基础地址、鉴权方式、请求方法、请求体，并查看完整响应。
            </p>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>
              当前令牌：{accessToken ? '已加载' : '未加载'}
            </Badge>
            <Badge variant='outline'>基础地址：{baseUrl || '未设置'}</Badge>
          </div>
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'>
          <div className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Settings2 className='h-4 w-4' />
                  接口设置
                </CardTitle>
                <CardDescription>
                  设置基础地址、鉴权方式和请求内容类型。
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>基础地址</label>
                  <Input
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder='/api/v1'
                  />
                </div>

                <div className='rounded-xl border p-4'>
                  <div className='flex items-center justify-between gap-4'>
                    <div className='space-y-1'>
                      <div className='flex items-center gap-2 text-sm font-medium'>
                        <Shield className='h-4 w-4' />
                        使用当前登录令牌
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        开启后会自动附带当前登录用户的 Bearer Token。
                      </p>
                    </div>
                    <Switch
                      checked={useAccessToken}
                      onCheckedChange={(checked) => {
                        setUseAccessToken(checked)
                        if (checked) {
                          setUseCustomToken(false)
                        }
                      }}
                    />
                  </div>
                </div>

                <div className='rounded-xl border p-4'>
                  <div className='flex items-center justify-between gap-4'>
                    <div className='space-y-1'>
                      <div className='text-sm font-medium'>使用自定义令牌</div>
                      <p className='text-xs text-muted-foreground'>
                        开启后会忽略当前登录令牌，使用你手动输入的 Token。
                      </p>
                    </div>
                    <Switch
                      checked={useCustomToken}
                      onCheckedChange={(checked) => {
                        setUseCustomToken(checked)
                        if (checked) {
                          setUseAccessToken(false)
                        }
                      }}
                    />
                  </div>

                  {useCustomToken && (
                    <Input
                      className='mt-4'
                      value={customToken}
                      onChange={(event) => setCustomToken(event.target.value)}
                      placeholder='粘贴 Bearer Token'
                    />
                  )}
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>请求体类型</label>
                  <Select
                    value={bodyType}
                    onValueChange={(value) => setBodyType(value as BodyType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='json'>JSON</SelectItem>
                      <SelectItem value='form'>表单</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Server className='h-4 w-4' />
                  接口预设
                </CardTitle>
                <CardDescription>
                  直接载入常用接口模板，再按需修改。
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-2'>
                {API_PRESETS.map((preset) => (
                  <button
                    key={`${preset.method}-${preset.path}`}
                    type='button'
                    onClick={() => handleUsePreset(preset)}
                    className='rounded-xl border px-3 py-3 text-left transition-colors hover:bg-muted/40'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='font-medium'>{preset.label}</span>
                      <Badge variant='outline'>{preset.method}</Badge>
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {preset.description}
                    </p>
                    <p className='mt-2 break-all font-mono text-[11px] text-muted-foreground'>
                      {preset.path}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Send className='h-4 w-4' />
                  接口调用
                </CardTitle>
                <CardDescription>
                  发送请求前会按当前设置拼出完整地址并附带鉴权头。
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]'>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>请求方法</label>
                    <Select
                      value={method}
                      onValueChange={(value) => setMethod(value as HttpMethod)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='GET'>GET</SelectItem>
                        <SelectItem value='POST'>POST</SelectItem>
                        <SelectItem value='PUT'>PUT</SelectItem>
                        <SelectItem value='DELETE'>DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>接口路径</label>
                    <Input
                      value={path}
                      onChange={(event) => setPath(event.target.value)}
                      placeholder='/public/articles/categories'
                    />
                  </div>
                </div>

                <div className='rounded-xl border bg-muted/20 px-3 py-2 text-sm'>
                  <div className='text-muted-foreground'>完整请求地址</div>
                  <div className='break-all font-mono text-xs'>{resolvedUrl}</div>
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>请求体</label>
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={12}
                    placeholder={
                      bodyType === 'json'
                        ? '{\n  "page": 1,\n  "per_page": 20\n}'
                        : 'username=admin&password=admin'
                    }
                    disabled={method === 'GET' || method === 'DELETE'}
                  />
                </div>

                <div className='flex flex-wrap justify-end gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      setBody('')
                      setResponseText('')
                      setResponseHeaders({})
                      setResponseStatus(undefined)
                      setResponseTime(undefined)
                    }}
                  >
                    清空
                  </Button>
                  <Button
                    type='button'
                    onClick={handleSendRequest}
                    disabled={isSubmitting}
                  >
                    <Send />
                    {isSubmitting ? '请求中...' : '发送请求'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <Braces className='h-4 w-4' />
                      响应结果
                    </CardTitle>
                    <CardDescription>
                      展示状态码、响应耗时、响应头和返回内容。
                    </CardDescription>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {responseStatus !== undefined && (
                      <Badge variant='outline'>状态：{responseStatus}</Badge>
                    )}
                    {responseTime !== undefined && (
                      <Badge variant='outline'>耗时：{responseTime} ms</Badge>
                    )}
                    <Button
                      type='button'
                      variant='outline'
                      onClick={handleCopyResponse}
                      disabled={!responseText}
                    >
                      <Copy />
                      复制响应
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='rounded-xl border p-3'>
                  <div className='mb-2 text-sm font-medium'>响应头</div>
                  {Object.keys(responseHeaders).length === 0 ? (
                    <p className='text-sm text-muted-foreground'>暂无响应头</p>
                  ) : (
                    <div className='space-y-1 text-xs'>
                      {Object.entries(responseHeaders).map(([key, value]) => (
                        <div key={key} className='break-all font-mono'>
                          <span className='text-muted-foreground'>{key}:</span>{' '}
                          {value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className='overflow-hidden rounded-xl border'>
                  <div className='border-b bg-muted/30 px-3 py-2 text-sm font-medium'>
                    响应体
                  </div>
                  <pre className='max-h-[520px] overflow-auto px-4 py-3 text-xs leading-6'>
                    {responseText || '暂无响应内容'}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}
