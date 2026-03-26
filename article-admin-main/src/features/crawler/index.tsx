import { Bug } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CrawlerForm } from '@/features/settings/crawler/crawler-form.tsx'

export function CrawlerCenter() {
  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ImageModeSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
        </div>
      </Header>

      <Main className='flex h-[calc(100vh-4rem)] flex-col'>
        <div className='mb-6 space-y-2'>
          <div className='flex items-center gap-3'>
            <Bug className='h-7 w-7 text-primary' />
            <h1 className='text-2xl font-bold'>爬虫中心</h1>
          </div>
          <p className='max-w-2xl text-sm text-muted-foreground'>
            这里只保留爬虫配置。设置模块、代理和 FlareSolverR 后，任务页会直接读取这里的配置执行抓取。
          </p>
        </div>

        <Card className='border-dashed'>
          <CardHeader className='pb-4'>
            <CardTitle>爬虫配置</CardTitle>
            <CardDescription>
              页面内直接配置，不再混入手动抓取、重置和其他维护操作。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CrawlerForm />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
