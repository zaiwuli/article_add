import { request } from './request'

export function getConfig<T>(key: string) {
  return request<T>({
    url: `/config/${key}`,
    method: 'get',
  })
}

export function postConfig(key: string, data: never) {
  return request({
    url: `/config`,
    method: 'post',
    data: {
      key: key,
      payload: data,
    },
  })
}
