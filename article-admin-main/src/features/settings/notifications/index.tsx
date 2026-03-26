import { Bell } from 'lucide-react'
import { ContentSection } from '../components/content-section'
import { NotificationsForm } from './notifications-form'

export function SettingsNotifications() {
  return (
    <ContentSection
      title='通知'
      desc='管理企业微信、Telegram 等通知渠道。'
      icon={<Bell size={18} />}
    >
      <NotificationsForm />
    </ContentSection>
  )
}
