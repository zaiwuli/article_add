import { Bell } from 'lucide-react'
import { ContentSection } from '../components/content-section'
import { NotificationsForm } from './notifications-form'

export function SettingsNotifications() {
  return (
    <ContentSection
      title='通知'
      desc='管理配置微信、TG等通知渠道'
      icon={<Bell size={18} />}
    >
      <NotificationsForm />
    </ContentSection>
  )
}
