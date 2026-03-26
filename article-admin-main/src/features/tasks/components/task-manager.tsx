import { useEffect, useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Pencil, Play, Plus, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { getConfig } from '@/api/config.ts'
import {
  addTask,
  deleteTask,
  getTaskFunctions,
  getTasks,
  runTask,
  updateTask,
} from '@/api/task.ts'
import type { CrawlerSection, TaskFunction } from '@/types/config.ts'
import { cn } from '@/lib/utils.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch.tsx'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ResponsiveModal } from '@/components/response-modal.tsx'

export interface Task {
  id: number
  task_name: string
  task_func: string
  task_args: string
  task_cron: string
  enable: boolean
}

const taskSchema = z.object({
  task_name: z.string().min(2, '任务名称至少 2 个字'),
  task_func: z.string().min(1, '请选择执行函数'),
  selected_fids: z.array(z.string()).min(1, '至少选择一个模块'),
  start_page: z.number().int().min(1, '起始页必须大于 0'),
  max_page: z.number().int().min(1, '页数必须大于 0'),
  task_cron: z.string().min(5, '请输入有效的 Cron 表达式'),
  enable: z.boolean(),
})

type TaskFormValues = z.infer<typeof taskSchema>

const DEFAULT_TASK_VALUES: TaskFormValues = {
  task_name: '',
  task_func: '',
  selected_fids: [],
  start_page: 1,
  max_page: 5,
  task_cron: '0 * * * *',
  enable: true,
}

function parseTaskArgs(taskArgs: string | null | undefined) {
  if (!taskArgs) {
    return {
      fids: [] as string[],
      start_page: 1,
      max_page: 5,
    }
  }

  try {
    const parsed = JSON.parse(taskArgs) as {
      fids?: Array<string | number>
      start_page?: number
      max_page?: number
    }

    return {
      fids: Array.isArray(parsed.fids)
        ? parsed.fids.map((item) => String(item))
        : [],
      start_page:
        typeof parsed.start_page === 'number' && parsed.start_page > 0
          ? parsed.start_page
          : 1,
      max_page:
        typeof parsed.max_page === 'number' && parsed.max_page > 0
          ? parsed.max_page
          : 5,
    }
  } catch {
    return {
      fids: [],
      start_page: 1,
      max_page: 5,
    }
  }
}

function buildTaskArgs(values: TaskFormValues) {
  return JSON.stringify({
    fids: values.selected_fids,
    start_page: values.start_page,
    max_page: values.max_page,
  })
}

function getMaxPageLabel(taskFunc: string) {
  if (taskFunc === 'sync_sht_by_tid') {
    return '最多扫描页数'
  }
  return '抓取页数'
}

function getPageRangeLabel(startPage: number, maxPage: number) {
  return `${startPage} - ${startPage + maxPage - 1}`
}

export default function TaskManager() {
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await getTasks()
      return res.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: taskFunctions } = useQuery({
    queryKey: ['task-functions'],
    queryFn: async () => {
      const res = await getTaskFunctions()
      return res.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: crawlerSections } = useQuery({
    queryKey: ['crawler-sections'],
    queryFn: async () => {
      const res = await getConfig<CrawlerSection[]>('CrawlerSections')
      return res.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: DEFAULT_TASK_VALUES,
  })

  const selectedFunc = useWatch({
    control: form.control,
    name: 'task_func',
  })

  useEffect(() => {
    if (editingTask) {
      const parsedArgs = parseTaskArgs(editingTask.task_args)
      form.reset({
        task_name: editingTask.task_name,
        task_func: editingTask.task_func,
        selected_fids: parsedArgs.fids,
        start_page: parsedArgs.start_page,
        max_page: parsedArgs.max_page,
        task_cron: editingTask.task_cron,
        enable: editingTask.enable,
      })
      return
    }

    if (isFormOpen) {
      form.reset(DEFAULT_TASK_VALUES)
    }
  }, [editingTask, form, isFormOpen])

  const currentFunction: TaskFunction | undefined = taskFunctions?.find(
    (item) => item.func_name === selectedFunc
  )

  const sectionLabelMap = useMemo(
    () =>
      new Map(
        (crawlerSections ?? []).map((item) => [
          String(item.fid),
          item.section || `模块 ${item.fid}`,
        ])
      ),
    [crawlerSections]
  )

  const taskFunctionLabelMap = useMemo(
    () =>
      new Map(
        (taskFunctions ?? []).map((item) => [item.func_name, item.func_label])
      ),
    [taskFunctions]
  )

  const saveTaskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const payload = {
        task_name: values.task_name,
        task_func: values.task_func,
        task_args: buildTaskArgs(values),
        task_cron: values.task_cron,
        enable: values.enable,
      }

      if (editingTask) {
        return updateTask({
          ...payload,
          id: editingTask.id,
        })
      }

      return addTask({
        ...payload,
        id: 0,
      })
    },
    onSuccess: (res) => {
      if (res.code === 0) {
        toast.success('任务已保存')
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        setIsFormOpen(false)
        setEditingTask(null)
      }
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: (res) => {
      if (res.code === 0) {
        toast.success('任务已删除')
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      }
    },
  })

  const handleDelete = (id: number) => {
    deleteTaskMutation.mutate(id)
  }

  const handleRunTask = async (taskId: number) => {
    const res = await runTask(taskId)
    if (res.code === 0) {
      toast.success('任务已启动')
    }
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between rounded-2xl border p-4 shadow-sm md:p-6'>
        <div className='space-y-1'>
          <p className='flex items-center gap-1 text-xs text-muted-foreground md:text-sm'>
            <Zap className='h-3 w-3 fill-amber-500 text-amber-500' />
            当前任务数：{tasks?.length ?? 0}
          </p>
          <p className='text-sm text-muted-foreground'>
            任务参数已经改成图形化配置，只有选中的模块才会参与抓取。
          </p>
        </div>

        <ResponsiveModal
          title={editingTask ? '编辑任务' : '新增任务'}
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          trigger={
            <Button
              type='button'
              onClick={() => setEditingTask(null)}
              className='rounded-full'
            >
              <Plus /> 新增任务
            </Button>
          }
        >
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                saveTaskMutation.mutate(values)
              )}
              className='space-y-5'
            >
              <FormField
                control={form.control}
                name='task_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任务名称</FormLabel>
                    <FormControl>
                      <Input placeholder='例如：MR 模块批量抓取' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='task_func'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>执行函数</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='选择执行函数' />
                        </SelectTrigger>
                        <SelectContent className='w-full'>
                          {(taskFunctions ?? []).map((item) => (
                            <SelectItem
                              key={item.func_name}
                              value={item.func_name}
                            >
                              {item.func_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {currentFunction?.func_args_description && (
                      <FormDescription>
                        {currentFunction.func_args_description}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='start_page'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>起始页</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='max_page'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{getMaxPageLabel(selectedFunc)}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='selected_fids'
                render={({ field }) => {
                  const selectedFids = field.value ?? []

                  return (
                    <FormItem>
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                          <FormLabel>抓取模块</FormLabel>
                          <FormDescription>
                            只有选中的模块会执行抓取，不选中就不会运行。
                          </FormDescription>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              field.onChange(
                                (crawlerSections ?? []).map((item) =>
                                  String(item.fid)
                                )
                              )
                            }
                          >
                            全选
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => field.onChange([])}
                          >
                            清空
                          </Button>
                        </div>
                      </div>

                      <div className='grid gap-2 rounded-xl border p-4 md:grid-cols-2'>
                        {(crawlerSections ?? []).length === 0 && (
                          <p className='text-sm text-muted-foreground'>
                            还没有可选模块，请先到爬虫中心配置模块。
                          </p>
                        )}

                        {(crawlerSections ?? []).map((section) => {
                          const fid = String(section.fid)
                          const checked = selectedFids.includes(fid)

                          return (
                            <label
                              key={fid}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                                checked
                                  ? 'border-primary bg-primary/5'
                                  : 'hover:bg-muted/40'
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                  if (nextChecked) {
                                    field.onChange(
                                      Array.from(
                                        new Set([...selectedFids, fid])
                                      )
                                    )
                                    return
                                  }

                                  field.onChange(
                                    selectedFids.filter((item) => item !== fid)
                                  )
                                }}
                              />
                              <span className='text-sm font-medium'>
                                {section.section || `模块 ${fid}`}
                              </span>
                            </label>
                          )
                        })}
                      </div>

                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              <FormField
                control={form.control}
                name='task_cron'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cron 表达式</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input {...field} />
                        <Clock className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                      </div>
                    </FormControl>
                    <FormDescription>
                      例如 `0 * * * *` 表示每小时执行一次。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='enable'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-xl border p-3'>
                    <div>
                      <FormLabel>启用任务</FormLabel>
                      <FormDescription>
                        关闭后任务不会加入调度器。
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button
                type='submit'
                disabled={saveTaskMutation.isPending}
                className='w-full'
              >
                {saveTaskMutation.isPending ? '保存中...' : '保存任务'}
              </Button>
            </form>
          </Form>
        </ResponsiveModal>
      </div>

      <div className='overflow-hidden rounded-2xl border shadow-sm'>
        <Table>
          <TableHeader className='hidden md:table-header-group'>
            <TableRow>
              <TableHead>任务名称</TableHead>
              <TableHead>执行函数</TableHead>
              <TableHead>抓取范围</TableHead>
              <TableHead>Cron 周期</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tasks ?? []).map((task) => {
              const parsedArgs = parseTaskArgs(task.task_args)
              const selectedSections = parsedArgs.fids
                .map((fid) => sectionLabelMap.get(fid) || `模块 ${fid}`)
                .join('、')

              return (
                <TableRow
                  key={task.id}
                  className='group flex flex-col border-b p-4 transition-colors md:table-row md:p-0'
                >
                  <TableCell className='p-0 pb-3 md:table-cell md:py-4'>
                    <div className='flex items-center gap-3 pl-2'>
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          task.enable
                            ? 'animate-pulse bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                            : 'bg-slate-400'
                        )}
                      />
                      <span className='text-base font-bold md:font-semibold'>
                        {task.task_name}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className='flex items-start justify-between px-0 py-2 md:table-cell md:py-4'>
                    <span className='text-sm font-medium text-muted-foreground md:hidden'>
                      执行函数
                    </span>
                    <Badge variant='outline' className='font-mono'>
                      {taskFunctionLabelMap.get(task.task_func) || task.task_func}
                    </Badge>
                  </TableCell>

                  <TableCell className='flex items-start justify-between px-0 py-2 md:table-cell md:py-4'>
                    <span className='text-sm font-medium text-muted-foreground md:hidden'>
                      抓取范围
                    </span>
                    <div className='space-y-1 text-right md:text-left'>
                      <p className='text-sm'>
                        页数：{getPageRangeLabel(parsedArgs.start_page, parsedArgs.max_page)}
                      </p>
                      <p className='max-w-[320px] text-xs text-muted-foreground'>
                        {selectedSections || '未配置模块'}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell className='flex items-center justify-between px-0 py-2 md:table-cell md:py-4'>
                    <span className='text-sm font-medium text-muted-foreground md:hidden'>
                      Cron 周期
                    </span>
                    <span className='font-mono text-sm text-muted-foreground'>
                      {task.task_cron}
                    </span>
                  </TableCell>

                  <TableCell className='flex justify-end px-0 pt-3 md:table-cell md:pt-4'>
                    <div className='flex w-full justify-end gap-1 border-t pt-3 md:w-auto md:border-none md:pt-0'>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='h-9 w-9 text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 md:h-8 md:w-8'
                        onClick={() => handleRunTask(task.id)}
                      >
                        <Play className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='h-9 w-9 md:h-8 md:w-8'
                        onClick={() => {
                          setEditingTask(task)
                          setIsFormOpen(true)
                        }}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='h-9 w-9 text-destructive md:h-8 md:w-8'
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
