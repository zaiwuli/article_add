import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getBootstrapStatus } from '@/api/user.ts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { data: bootstrapStatus, isLoading } = useQuery({
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
          <CardTitle className='text-lg tracking-tight'>初始化账号</CardTitle>
          <CardDescription>
            {isLoading
              ? '正在检查系统是否已存在账号...'
              : bootstrapStatus?.allow_register
                ? '系统还没有管理员账号，先创建第一个登录账号。'
                : `系统已经内置测试账号 ${bootstrapStatus?.default_username || 'admin'} / ${bootstrapStatus?.default_password || 'admin'}，不再开放初始化注册。`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>正在加载...</p>
          ) : bootstrapStatus?.allow_register ? (
            <SignUpForm />
          ) : (
            <p className='text-sm text-muted-foreground'>
              请直接前往
              <Link
                to='/sign-in'
                className='ml-1 underline underline-offset-4 hover:text-primary'
              >
                登录页
              </Link>
              。
            </p>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
