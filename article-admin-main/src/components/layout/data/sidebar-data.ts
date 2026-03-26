import {
  Bug,
  Database,
  LayoutDashboard,
  ListTodo,
  ScrollText,
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
          title: '爬虫中心',
          url: '/crawler',
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
          title: '日志空间',
          url: '/logs',
          icon: ScrollText,
        },
      ],
    },
  ],
}
