import { request } from '@/api/request.ts'
import type { Task } from '@/features/tasks/components/task-manager.tsx'

export function getTasks() {
  return request<Task[]>({ url: '/tasks' })
}

export function addTask(task: Task) {
  return request({ url: '/tasks', method: 'post', data: task })
}

export function updateTask(task: Task) {
  return request({ url: '/tasks', method: 'put', data: task })
}

export function deleteTask(task_id: number) {
  return request({ url: `/tasks/${task_id}`, method: 'delete' })
}

export function runTask(task_id: number) {
  return request<Task[]>({ url: `/tasks/run/${task_id}`, method: 'get' })
}
