import { Bug } from 'lucide-react'
import { ContentSection } from '../components/content-section'
import { CrawlerForm } from './crawler-form'

export function SettingsCrawler() {
  return (
    <ContentSection
      title='爬虫板块'
      desc='维护可抓取的板块列表，新增板块后任务可直接按 fid 抓取。'
      icon={<Bug className='h-5 w-5 text-primary' />}
    >
      <CrawlerForm />
    </ContentSection>
  )
}
