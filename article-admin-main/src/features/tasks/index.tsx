import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import TaskManager from '@/features/tasks/components/task-manager.tsx'

export function Tasks() {
  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ImageModeSwitch/>
          <ThemeSwitch />
          <ConfigDrawer />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>任务调度管理</h2>
            <p className='text-muted-foreground'>
              配置并监控自动执行的定时任务
            </p>
          </div>
        </div>
        <TaskManager/>
      </Main>
    </>


  )
}
