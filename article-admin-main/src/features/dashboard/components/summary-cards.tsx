import type { Category } from '@/types/article.ts'
import { Database, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card.tsx'

export function SummaryCards({ data }: { data: Category[] }) {
  const total = data.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
      {/* 分类数 */}
      <Card className='relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background'>
        {/* 装饰光斑 */}
        <div className='absolute -top-8 -right-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl' />

        <CardContent className='flex items-center gap-4 p-6'>
          <div className='rounded-xl bg-primary/15 p-3'>
            <Layers className='h-6 w-6 text-primary' />
          </div>

          <div>
            <div className='text-sm text-muted-foreground'>分类总数</div>
            <div className='text-3xl font-bold tracking-tight'>
              {data.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 总资源数 */}
      <Card className='relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-background'>
        <div className='absolute -top-8 -right-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl' />

        <CardContent className='flex items-center gap-4 p-6'>
          <div className='rounded-xl bg-emerald-500/15 p-3'>
            <Database className='h-6 w-6 text-emerald-500' />
          </div>

          <div>
            <div className='text-sm text-muted-foreground'>总资源数</div>
            <div className='text-3xl font-bold tracking-tight tabular-nums'>
              {total.toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
