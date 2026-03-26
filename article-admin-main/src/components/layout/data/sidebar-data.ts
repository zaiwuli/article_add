import {
  Bug,
  Database,
  HelpCircle,
  LayoutDashboard,
  ListTodo,
  Settings,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'envyafish',
    avatar: '/avatars/shadcn.jpg',
  },
  navGroups: [
    {
      title: '通用',
      items: [
        {
          title: '看板',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: '任务',
          url: '/tasks',
          icon: ListTodo,
        },
        {
          title: '资源数据',
          url: '/articles',
          icon: Database,
        },
        {
          title: '爬虫',
          url: '/settings/crawler',
          icon: Bug,
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          title: '设置',
          url: '/settings',
          icon: Settings,
        },
        {
          title: '帮助中心',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
