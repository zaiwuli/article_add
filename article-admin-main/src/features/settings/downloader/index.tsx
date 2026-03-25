import { ContentSection } from '@/features/settings/components/content-section.tsx'
import { DownloaderForm } from '@/features/settings/downloader/downloader-form.tsx'
import { Download } from 'lucide-react'

export function SettingsDownloader() {
  return (
    <ContentSection title='下载器' desc='配置下载器的连接信息，以及预设下载目录' icon={<Download className='h-5 w-5 text-primary' />}>
      <DownloaderForm />
    </ContentSection>
  )
}
