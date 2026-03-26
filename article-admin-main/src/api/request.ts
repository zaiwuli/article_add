import type { AxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types/response'
import { toast } from 'sonner'
import axios from './axios'

export function request<T>(
  config: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  return axios<ApiResponse<T>>(config)
    .then((response) => {
      const body = response.data

      if (body.code !== 0) {
        toast.error(body.message)
      }
      return body
    })
    .catch((error) => {
      const message =
        error?.response?.data?.message || error?.message || 'request failed'
      toast.error(message)
      throw error
    })
}
