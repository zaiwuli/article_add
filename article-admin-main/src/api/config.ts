import { request } from './request'

export function getConfig<T>(key: string) {
  return request<T>({
    url: `/config/${key}`,
    method: 'get',
  })
}

export function postConfig<T>(key: string, data: T) {
  return request({
    url: '/config/',
    method: 'post',
    data: {
      key,
      payload: data,
    },
  })
}
