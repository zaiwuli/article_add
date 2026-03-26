import type {
  TransferRunResult,
  TransferTablesResult,
  TransferTargetConfig,
} from '@/types/transfer'
import { request } from './request'

export function getTransferConfig() {
  return request<TransferTargetConfig>({
    url: '/transfer/config',
    method: 'get',
  })
}

export function saveTransferConfig(data: TransferTargetConfig) {
  return request({
    url: '/transfer/config',
    method: 'post',
    data,
  })
}

export function testTransferConnection(data: TransferTargetConfig) {
  return request({
    url: '/transfer/test',
    method: 'post',
    data,
  })
}

export function getTransferTables(data: TransferTargetConfig) {
  return request<TransferTablesResult>({
    url: '/transfer/tables',
    method: 'post',
    data,
  })
}

export function runTransfer() {
  return request<TransferRunResult>({
    url: '/transfer/run',
    method: 'post',
  })
}
