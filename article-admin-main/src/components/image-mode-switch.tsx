import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, ScanEye } from 'lucide-react'
import { useImageMode } from '@/context/image-mode-provider'

export function ImageModeSwitch() {
  const { mode, setMode } = useImageMode()

  const current = {
    show: { label: '显示图片', icon: Eye },
    blur: { label: '模糊图片', icon: ScanEye },
    hide: { label: '隐藏图片', icon: EyeOff },
  }[mode]

  const Icon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={current.label}
        >
          <Icon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode('show')}>
          <Eye className="mr-2 h-4 w-4" />
          显示图片
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setMode('blur')}>
          <ScanEye className="mr-2 h-4 w-4" />
          模糊图片
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setMode('hide')}>
          <EyeOff className="mr-2 h-4 w-4" />
          隐藏图片
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
