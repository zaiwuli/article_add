import type { User } from '@/types/user.ts'
import { request } from './request'

export interface BootstrapStatus {
  has_user: boolean
  allow_register: boolean
  default_username?: string
  default_password?: string
}

export function login(data: { username: string; password: string }) {
  return request<User>({
    url: '/users/login',
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data,
  })
}

export function getBootstrapStatus() {
  return request<BootstrapStatus>({
    url: '/users/bootstrap-status',
    method: 'get',
  })
}

export function createUser(data: { username: string; password: string }) {
  return request({
    url: '/users/',
    method: 'post',
    data,
  })
}

export function updateUser(data: { username: string; password: string }) {
  return request({
    url: '/users/',
    method: 'put',
    data,
  })
}
