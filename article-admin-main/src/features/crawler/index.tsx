import { Bug } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CrawlerForm } from '@/features/settings/crawler/crawler-form'

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

      <Main className='flex h-[calc(100vh-4rem)] flex-col gap-4'>
        <div className='flex items-center justify-between rounded-2xl border p-4 shadow-sm'>
          <div className='flex items-center gap-3'>
            <Bug className='h-6 w-6 text-primary' />
            <h1 className='text-2xl font-bold'>爬虫中心</h1>
          </div>
        </div>

        <CrawlerForm />
      </Main>
    </>
  )
}
