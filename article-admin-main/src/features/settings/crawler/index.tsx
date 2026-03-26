import { Bug } from 'lucide-react'
import { ContentSection } from '../components/content-section'
import { CrawlerForm } from './crawler-form'

export function SettingsCrawler() {
  return (
    <ContentSection
      title='爬虫中心'
      desc='管理抓取板块、代理网络、FlareSolverR 和手动抓取预览。'
      icon={<Bug className='h-5 w-5 text-primary' />}
    >
      <CrawlerForm />
    </ContentSection>
  )
}
