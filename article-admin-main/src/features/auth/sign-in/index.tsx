import { useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { getBootstrapStatus } from '@/api/user.ts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { data: bootstrapStatus } = useQuery({
    queryKey: ['bootstrap-status'],
    queryFn: async () => {
      const res = await getBootstrapStatus()
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>登录</CardTitle>
          <CardDescription>
            使用现有账号登录系统。默认测试账号：
            <span className='mx-1 font-medium text-foreground'>
              {bootstrapStatus?.default_username || 'admin'}
            </span>
            /
            <span className='mx-1 font-medium text-foreground'>
              {bootstrapStatus?.default_password || 'admin'}
            </span>
            。
            {bootstrapStatus?.allow_register && (
              <>
                {' '}
                还没有账号？
                <Link
                  to='/sign-up'
                  className='underline underline-offset-4 hover:text-primary'
                >
                  立即创建
                </Link>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
