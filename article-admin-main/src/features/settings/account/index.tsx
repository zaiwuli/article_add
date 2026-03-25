import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'
import { UserPen } from 'lucide-react'

export function SettingsAccount() {
  return (
    <ContentSection
      title='账户'
      desc='编辑你的账号密码信息'
      icon={<UserPen className='h-5 w-5 text-primary' />}
    >
      <AccountForm />
    </ContentSection>
  )
}
