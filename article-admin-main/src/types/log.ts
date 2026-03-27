export interface LogFileInfo {
  name: string
  size: number
  updated_time: string
  compressed: boolean
}

export interface LogScopeItem {
  key: string
  label: string
  files: LogFileInfo[]
}

export interface LogScopeResult {
  scopes: LogScopeItem[]
}

export interface LogContentResult {
  scope: string
  name?: string | null
  lines: number
  content: string
  updated_time?: string | null
  size: number
}
