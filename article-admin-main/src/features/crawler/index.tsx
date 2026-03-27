import { Link } from '@tanstack/react-router'
import { Blocks, Bug, Settings2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { ImageModeSwitch } from '@/components/image-mode-switch.tsx'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CrawlerConfigCenter } from '@/features/crawler/config-center'
import { CrawlerIssueCenter } from '@/features/crawler/issue-center'
import { CrawlerModuleCenter } from '@/features/crawler/modules-center'

export type CrawlerTab = 'issues' | 'config' | 'modules'

const crawlerTabs: Array<{
  value: CrawlerTab
  label: string
  description: string
  icon: typeof Wrench
}> = [
  {
    value: 'issues',
    label: '抓取处理',
    description: '查看抓取异常、压缩包附件和一键处理动作。',
    icon: Wrench,
  },
  {
    value: 'config',
    label: '抓取配置',
    description: '维护抓取网络、处理目录和自动下载解压策略。',
    icon: Settings2,
  },
  {
    value: 'modules',
    label: '抓取模块',
    description: '单独维护模块列表，任务页和抓取链路会直接读取这里。',
    icon: Blocks,
  },
]

function CrawlerTabLink({
  value,
  label,
  icon: Icon,
  active,
}: {
  value: CrawlerTab
  label: string
  icon: typeof Wrench
  active: boolean
}) {
  return (
    <Link
      to='/crawler'
      search={{ tab: value }}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors',
        active
          ? 'border-primary/30 bg-background text-foreground shadow-sm'
          : 'border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
      )}
    >
      <Icon className='h-4 w-4' />
      {label}
    </Link>
  )
}

export function CrawlerCenter({ activeTab }: { activeTab: CrawlerTab }) {
  const activeMeta =
    crawlerTabs.find((item) => item.value === activeTab) ?? crawlerTabs[0]

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
        <div className='flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-4 shadow-sm'>
          <div className='space-y-3'>
            <div className='flex items-center gap-3'>
              <Bug className='h-7 w-7 text-primary' />
              <div>
                <h1 className='text-2xl font-bold'>抓取中心</h1>
                <p className='text-sm text-muted-foreground'>
                  抓取处理、抓取配置和抓取模块已经拆成平级页面，方便分别维护。
                </p>
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              {crawlerTabs.map((item) => (
                <CrawlerTabLink
                  key={item.value}
                  value={item.value}
                  label={item.label}
                  icon={item.icon}
                  active={item.value === activeTab}
                />
              ))}
            </div>
          </div>

          <Badge variant='outline' className='h-8 rounded-full px-3 text-xs'>
            当前页面：{activeMeta.label}
          </Badge>
        </div>

        <div className='rounded-2xl border bg-muted/15 px-4 py-3 text-sm text-muted-foreground'>
          {activeMeta.description}
        </div>

        {activeTab === 'issues' && <CrawlerIssueCenter />}
        {activeTab === 'config' && <CrawlerConfigCenter />}
        {activeTab === 'modules' && <CrawlerModuleCenter />}
      </Main>
    </>
  )
}
