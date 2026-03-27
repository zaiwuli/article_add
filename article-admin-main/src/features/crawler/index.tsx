import { useState } from 'react'
import { Bug } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CrawlerIssueCenter } from '@/features/crawler/issue-center'
import { CrawlerForm } from '@/features/settings/crawler/crawler-form'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function CrawlerCenter() {
  const [activeTab, setActiveTab] = useState<'config' | 'issues'>('config')

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

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'config' | 'issues')}
        >
          <TabsList className='w-full justify-start gap-2 rounded-2xl border bg-transparent p-1'>
            <TabsTrigger value='config'>抓取配置</TabsTrigger>
            <TabsTrigger value='issues'>抓取处理</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'config' ? <CrawlerForm /> : <CrawlerIssueCenter />}
      </Main>
    </>
  )
}
