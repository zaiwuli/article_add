import { Link } from '@tanstack/react-router'
import { ArrowRight, Bug, Database, FileText } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
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
        <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <div className='flex items-center gap-3'>
              <Bug className='h-7 w-7 text-primary' />
              <h1 className='text-2xl font-bold'>爬虫中心</h1>
            </div>
            <p className='max-w-2xl text-sm text-muted-foreground'>
              在这里集中管理爬虫模块、代理网络、FlareSolverR、手动抓取入库和测试维护能力。
            </p>
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Bug className='h-4 w-4' />
                模块配置
              </CardTitle>
              <CardDescription>
                新增模块后，任务页会自动把它变成可勾选的抓取对象。
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Database className='h-4 w-4' />
                直接入库
              </CardTitle>
              <CardDescription>
                手动抓取和定时任务都可以直接写入资源表，不需要额外确认。
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className='border-dashed'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <FileText className='h-4 w-4' />
                日志联动
              </CardTitle>
              <CardDescription>
                抓取完成后可以直接到日志空间查看运行日志、抓取摘要和失败记录。
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className='mt-6 border-dashed'>
          <CardHeader>
            <CardTitle>推荐使用流程</CardTitle>
            <CardDescription>
              先配置模块和网络，再去任务页创建图形化任务，最后到日志空间看执行结果。
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-3'>
            <Button asChild variant='outline'>
              <Link to='/tasks'>
                去任务页
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant='outline'>
              <Link to='/logs'>
                去日志空间
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className='mt-6'>
          <CardHeader>
            <CardTitle>爬虫配置</CardTitle>
            <CardDescription>
              页面内直接配置，不再使用抽屉交互，风格和其他模块保持一致。
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
