import type { Category } from '@/types/article.ts'
import { Layers } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function CategoryCards({ data }: { data: Category[] }) {
  return (
    <div className='grid grid-cols-2 gap-4 md:grid-cols-6'>
      {data.map((cat,index) => (
        <Card className='bg-gradient-to-br from-background to-muted transition hover:shadow-lg' key={index}>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle className='text-sm'>{cat.category}</CardTitle>
            <Layers className='h-4 w-4 text-muted-foreground' />
          </CardHeader>

          <CardContent>
            <div className='text-2xl font-semibold'>
              {cat.count.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
