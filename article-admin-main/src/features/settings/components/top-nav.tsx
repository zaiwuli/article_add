import { type JSX } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

type TopNavProps = React.HTMLAttributes<HTMLElement> & {
  items: {
    href: string
    title: string
    icon: JSX.Element
  }[]
}

export function TopNav({ items }: TopNavProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const handleValueChange = (value: string) => {
    navigate({ to: value })
  }

  return (
      <ScrollArea orientation='horizontal' type='hover' className='w-full'>
          <Tabs value={pathname} onValueChange={handleValueChange} className="space-y-6">
            <TabsList className="w-full">
              {items.map((item) => (
                <TabsTrigger
                  key={item.href}
                  value={item.href}
                  className="gap-2"
                >
                  <span className='me-2'>{item.icon}</span>
                  {item.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
      </ScrollArea>
  )
}