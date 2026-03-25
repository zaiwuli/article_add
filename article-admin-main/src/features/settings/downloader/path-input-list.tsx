import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'

export type PathItem = {
  path: string
  label: string
}

export function PathListInput({
  value,
  onChange,
}: {
  value: PathItem[]
  onChange: (v: PathItem[]) => void
}) {
  const addPath = () => onChange([...value, { label: '', path: '' }])

  const updateItem = (index: number, key: 'label' | 'path', val: string) => {
    onChange(
      value.map((item, i) => (i == index ? { ...item, [key]: val } : item))
    )
  }

  const removePath = (index: number) => {
    onChange(value.filter((_item, i) => i !== index))
  }

  return (
    <div className='space-y-2'>
      {value.map((item, index) => (
        <div key={index} className='grid grid-cols-11 gap-2'>
          <Input
            className='col-span-5'
            placeholder='名称（如：电影）'
            value={item.label}
            onChange={(e) => updateItem(index, 'label', e.target.value)}
          />
          <Input
            className='col-span-5'
            placeholder='/downloads/movie,fileid'
            value={item.path}
            onChange={(e) => updateItem(index, 'path', e.target.value)}
          />
          <Button
            size='icon'
            variant='ghost'
            className="text-destructive"
            onClick={() => removePath(index)}
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <Button variant='outline' onClick={addPath}>
        <Plus className='mr-2 h-4 w-4' />
        添加目录
      </Button>
    </div>
  )
}
