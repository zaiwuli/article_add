import { useState } from 'react'
import { Bug } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrawlerIssueCenter } from '@/features/crawler/issue-center'
import { CrawlerForm } from '@/features/settings/crawler/crawler-form'

export function CrawlerCenter() {
  const [activeTab, setActiveTab] = useState<'issues' | 'config'>('issues')

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
        <div className='mb-2 flex items-start justify-between gap-4'>
          <div>
            <div className='mb-2 flex items-center gap-3'>
              <Bug className='h-7 w-7 text-primary' />
              <h1 className='text-2xl font-bold'>抓取中心</h1>
            </div>
            <p className='text-sm text-muted-foreground'>
              这里集中展示抓取异常、附件处理和抓取配置。压缩包附件目前支持探测、
              下载和解压结果导入，但还不支持自动解压。
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'issues' | 'config')}
        >
          <TabsList className='w-full justify-start gap-2 rounded-2xl border bg-transparent p-1'>
            <TabsTrigger value='issues'>抓取处理</TabsTrigger>
            <TabsTrigger value='config'>抓取配置</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'issues' ? <CrawlerIssueCenter /> : <CrawlerForm />}
      </Main>
    </>
  )
}
