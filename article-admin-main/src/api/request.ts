import type { AxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types/response'
import axios from './axios'
import { toast } from 'sonner'
export function request<T>(
  config: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  return axios<ApiResponse<T>>(config).then((response) => {
    const body = response.data

    if (body.code !== 0) {
      toast.error(body.message)
    }
    return body
  })
}
