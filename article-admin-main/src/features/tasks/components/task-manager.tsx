import { useState, useEffect } from 'react'
import * as z from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TaskFunction } from '@/types/config.ts'
import { Plus, Pencil, Trash2, Clock, Zap, Play } from 'lucide-react'
import { toast } from 'sonner'
import { getConfig } from '@/api/config.ts'
import {
  addTask,
  deleteTask,
  getTasks,
  runTask,
  updateTask,
} from '@/api/task.ts'
import { cn } from '@/lib/utils.ts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea.tsx'
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
  task_name: z.string().min(2, '任务名称至少2个字符'),
  task_func: z.string().min(1, '请选择执行函数'),
  task_args: z.string(),
  task_cron: z.string().min(5, '请输入有效的 Cron 表达式'),
  enable: z.boolean(),
})

export default function TaskManager() {
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await getTasks()
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const saveTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof taskSchema>) => {
      if (editingTask) {
        return await updateTask({
          ...values,
          id: editingTask.id,
        })
      } else {
        return await addTask({
          ...values,
          id: 0,
        })
      }
    },

    onSuccess: (res) => {
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setIsFormOpen(false)
      setEditingTask(null)
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: (res) => {
      toast.success(res.message)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const { data: taskFunctions } = useQuery({
    queryKey: ['taskFunc'],
    queryFn: async () => {
      const res = await getConfig<TaskFunction[]>('TaskFunction')
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      task_name: '',
      task_func: '',
      task_args: '',
      task_cron: '0 * * * *',
      enable: true,
    },
  })

  const selectedFunc = useWatch({
    control: form.control,
    name: 'task_func',
  })

  // 处理编辑状态回填
  useEffect(() => {
    if (editingTask) {
      form.reset(editingTask)
    } else if (isFormOpen) {
      form.reset({
        task_name: '',
        task_func: '',
        task_args: '',
        task_cron: '0 * * * *',
        enable: true,
      })
    }
  }, [editingTask, isFormOpen, form])

  const handleDelete = async (id: number) => {
    deleteTaskMutation.mutate(id)
  }

  const handleRunTask = async (taskId: number) => {
    const res = await runTask(taskId)
    toast.success(res.message)
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between rounded-2xl border p-4 shadow-sm md:p-6'>
        <div className='space-y-1'>
          <p className='flex items-center gap-1 text-xs text-muted-foreground md:text-sm'>
            <Zap className='h-3 w-3 fill-amber-500 text-amber-500' />
            当前活跃任务: {tasks?.length}
          </p>
        </div>
        <ResponsiveModal
          title={editingTask ? '编辑任务' : '创建新任务'}
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          trigger={
            <Button
              onClick={() => setEditingTask(null)}
              className='rounded-full'
            >
              <Plus /> 新增任务
            </Button>
          }
        >
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => {
                saveTaskMutation.mutate(values)
              })}
              className='space-y-4'
            >
              <FormField
                control={form.control}
                name='task_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任务名称</FormLabel>
                    <FormControl>
                      <Input placeholder='输入任务名称' {...field} />
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='选择函数' />
                        </SelectTrigger>
                        <SelectContent className='w-full'>
                          {taskFunctions?.map((f) => (
                            <SelectItem key={f.func_name} value={f.func_name}>
                              {f.func_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='task_args'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>函数参数</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder='{"arg_name":"arg_value"}'
                      ></Textarea>
                    </FormControl>
                    <FormDescription>
                      <span>
                        {
                          taskFunctions?.find(
                            (f) => f.func_name === selectedFunc
                          )?.func_args_description
                        }
                      </span>
                    </FormDescription>
                  </FormItem>
                )}
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
                        <Clock className='absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                      </div>
                    </FormControl>
                    <FormDescription>
                      <span className='rounded bg-muted px-1.5 py-0.5 italic'>
                        */5 * * * * (每5分)
                      </span>
                      <span className='rounded bg-muted px-1.5 py-0.5 italic'>
                        0 0 * * * (每日)
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='enable'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between'>
                    <FormLabel>开启任务</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type='submit' disabled={saveTaskMutation.isPending} className="w-full">
                {saveTaskMutation.isPending ? '保存中...' : '保存配置'}
              </Button>
            </form>
          </Form>
        </ResponsiveModal>
      </div>
      <div className='overflow-hidden rounded-2xl border shadow-sm'>
        <Table>
          {/* 1. 移动端隐藏表头 */}
          <TableHeader className='hidden md:table-header-group'>
            <TableRow>
              <TableHead>任务名称</TableHead>
              <TableHead>执行逻辑</TableHead>
              <TableHead>Cron 周期</TableHead>
              <TableHead className='text-right'>管理</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {tasks?.map((task) => (
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
                          : 'bg-slate-400 shadow-none'
                      )}
                    />
                    <span className='font-bold text-base md:font-semibold'>{task.task_name}</span>
                  </div>
                </TableCell>

                <TableCell className='flex items-start justify-between py-2 px-0 md:table-cell md:py-4'>
                  <span className='text-sm font-medium text-muted-foreground md:hidden'>执行逻辑</span>
                  <div className='flex flex-col items-end gap-2 md:flex-row md:items-center'>
                    <Badge variant='outline' className='font-mono'>
                      {task.task_func}
                    </Badge>
                    <div className='flex items-center gap-2'>
                      <span className='hidden text-xs text-muted-foreground md:inline'>→</span>
                      <span className='text-xs text-slate-600 max-w-[200px] truncate md:max-w-none'>
                {task.task_args}
              </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell className='flex items-center justify-between py-2 px-0 md:table-cell md:py-4'>
                  <span className='text-sm font-medium text-muted-foreground md:hidden'>Cron 周期</span>
                  <span className='font-mono text-sm text-muted-foreground'>
            {task.task_cron}
          </span>
                </TableCell>

                <TableCell className='flex justify-end pt-3 px-0 md:table-cell md:pt-4 md:sticky md:right-0'>
                  <div className='flex gap-1 border-t pt-3 w-full justify-end md:border-none md:pt-0 md:w-auto'>
                    <Button
                      variant='outline'
                      size='icon'
                      className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 md:h-8 md:w-8 md:border-none md:bg-transparent"                      onClick={() => handleRunTask(task.id)}
                    >
                      <Play className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='outline'
                      size='icon'
                      className="h-9 w-9 md:h-8 md:w-8 md:variant-ghost"
                      onClick={() => {
                        setEditingTask(task)
                        setIsFormOpen(true)
                      }}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='outline'
                      size='icon'
                      className='h-9 w-9 text-destructive md:h-8 md:w-8 md:variant-ghost'
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
