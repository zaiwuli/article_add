export interface TransferTargetConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  schema: string
  table: string
}

export interface TransferTablesResult {
  schema: string
  tables: string[]
}

export interface TransferRunResult {
  schema: string
  table: string
  total: number
  inserted: number
  skipped: number
}
