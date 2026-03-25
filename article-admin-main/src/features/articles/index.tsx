import { useIsMobile } from '@/hooks/use-mobile.tsx'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ArticlesMobile } from '@/features/articles/components/articles-mobile.tsx'
import { ArticlesDesktop } from '@/features/articles/components/articles-desktop.tsx'

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
        {isMobile ? <ArticlesMobile /> : <ArticlesDesktop />}
      </Main>
    </>
  )
}