import { UserPen } from 'lucide-react'
import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='账户'
      desc='修改当前登录账户的用户名和密码。'
      icon={<UserPen className='h-5 w-5 text-primary' />}
    >
      <AccountForm />
    </ContentSection>
  )
}
