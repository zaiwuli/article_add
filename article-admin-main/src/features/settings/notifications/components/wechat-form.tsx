import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Separator } from '@/components/ui/separator.tsx'
import { Switch } from '@/components/ui/switch.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'

const wechatSchema = z.object({
  enable: z.boolean(),
  push_image: z.boolean(),
  corp_id: z.string(),
  corp_secret: z.string(),
  agent_id: z.string(),
  token: z.string(),
  encoding_aes_key: z.string(),
  to_user: z.string(),
  proxy: z.string().optional(),
  template: z.string(),
})

export function WechatNotificationForm() {
  const wxTemplate = `📁 板块：{{section}} / {{type}}
📦 体积：{{size}}
🗓 发布：{{publish_date}}
⬇️ 下载器：{{downloader}}
📂 保存目录：{{save_path}}
🔗 Magnet：
{{magnet}}`

  const form = useForm({
    resolver: zodResolver(wechatSchema),
    defaultValues: {
      enable: false,
      push_image: false,
      corp_id: '',
      corp_secret: '',
      agent_id: '',
      token: '',
      encoding_aes_key: '',
      to_user: '@all',
      proxy: '',
      template: wxTemplate,
    },
  })

  const onSubmit = (values: z.infer<typeof wechatSchema>) => {
    console.log('wechat config', values)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='max-w-md space-y-4'
      >
        <FormField
          control={form.control}
          name='enable'
          render={({ field }) => (
            <FormItem className='flex items-center justify-between'>
              <FormLabel>启用企业微信通知</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='push_image'
          render={({ field }) => (
            <FormItem className='flex items-center justify-between'>
              <FormLabel>推送图片</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Separator />

        <FormField
          name='corp_id'
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>企业 ID</FormLabel>
              <FormControl>
                <Input placeholder='WECHAT_CORP_ID' {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name='corp_secret'
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>企业密钥</FormLabel>
              <FormControl>
                <Input placeholder='WECHAT_CORP_SECRET' {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name='agent_id'
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>应用 ID</FormLabel>
              <FormControl>
                <Input placeholder='WECHAT_AGENT_ID' {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name='template'
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>消息模板</FormLabel>
              <FormControl>
                <Textarea rows={6} {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type='submit' className='min-w-[140px]'>
          <Save className='mr-2 h-4 w-4' />
          保存配置
        </Button>
      </form>
    </Form>
  )
}
