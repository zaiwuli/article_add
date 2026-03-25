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

const telegramSchema = z.object({
  enable: z.boolean(),
  push_image: z.boolean(),
  spoiler: z.boolean(),
  bot_token: z.string(),
  chat_id: z.string(),
  template: z.string(),
})

export function TelegramNotificationForm() {
  const tgTemplate = `🚀 {{title}}

📁 板块：{{section}} / {{category}}
📦 体积：{{size}}
🗓 发布：{{publish_date}}
⬇️ 下载器：{{downloader}}
📂 保存目录：{{save_path}}
🔗 Magnet：
{{magnet}}`

  const form = useForm({
    resolver: zodResolver(telegramSchema),
    defaultValues: {
      enable: false,
      push_image: false,
      spoiler: false,
      bot_token: '',
      chat_id: '',
      template: tgTemplate,
    },
  })

  const onSubmit = (values: z.infer<typeof telegramSchema>) => {
    console.log('telegram config', values)
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
              <FormLabel>启用telegram通知</FormLabel>
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
              <FormLabel>启用图片推送</FormLabel>
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
          name='spoiler'
          render={({ field }) => (
            <FormItem className='flex items-center justify-between'>
              <FormLabel>启用防剧透</FormLabel>
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
          name='bot_token'
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bot Token</FormLabel>
              <FormControl>
                <Input placeholder='TELEGRAM_BOT_TOKEN' {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name='chat_id'
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chat ID</FormLabel>
              <FormControl>
                <Input placeholder='TELEGRAM_CHAT_ID' {...field} />
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
