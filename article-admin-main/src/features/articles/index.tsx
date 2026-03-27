import { Database } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile.tsx'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ArticlesDesktop } from '@/features/articles/components/articles-desktop'
import { ArticlesMobile } from '@/features/articles/components/articles-mobile'

export function Articles() {
  const isMobile = useIsMobile()

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
        <div className='mb-6 flex items-start justify-between gap-4'>
          <div>
            <div className='mb-2 flex items-center gap-3'>
              <Database className='h-7 w-7 text-primary' />
              <h1 className='text-2xl font-bold'>资源数据</h1>
            </div>
            <p className='text-sm text-muted-foreground'>
              查看已经写入资源表的抓取结果。
            </p>
          </div>
        </div>

        {isMobile ? <ArticlesMobile /> : <ArticlesDesktop />}
      </Main>
    </>
  )
}
