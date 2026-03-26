import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { updateUser } from '@/api/user.ts'
import { Button } from '@/components/ui/button.tsx'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const accountSchema = z.object({
  username: z.string().min(2, '用户名至少 2 位'),
  password: z.string().min(5, '密码至少 5 位'),
})

export function AccountForm() {
  const account = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      username: 'admin',
      password: 'admin',
    },
  })

  const handleSubmit = async (data: z.infer<typeof accountSchema>) => {
    const res = await updateUser(data)
    if (res.code === 0) {
      toast.success(res.message)
    }
  }

  return (
    <Form {...account}>
      <form
        onSubmit={account.handleSubmit(handleSubmit)}
        className='max-w-md space-y-4'
      >
        <FormField
          control={account.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
              <FormControl>
                <Input placeholder='请输入用户名' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={account.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='默认密码：admin' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit'>
          <Save />
          保存配置
        </Button>
      </form>
    </Form>
  )
}
