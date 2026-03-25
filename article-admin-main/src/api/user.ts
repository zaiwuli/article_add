import type { User } from '@/types/user.ts'
import { request } from './request'

export function login(data: { username: string; password: string }) {
  return request<User>({
    url: '/users/login',
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: data,
  })
}

export function create_user(params: { username: string; password: string }) {
  return request({
    url: '/users',
    method: 'post',
    params,
  })
}



export function update_user(params: { username: string; password: string }) {
  return request({
    url: '/users',
    method: 'put',
    params,
  })
}