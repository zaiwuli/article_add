import * as React from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label='pagination'
      className={cn('mx-auto flex w-full', className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li {...props} />
}

type PaginationLinkProps = React.ComponentProps<'button'> & {
  isActive?: boolean
}

function PaginationLink({
  className,
  isActive,
  type = 'button',
  ...props
}: PaginationLinkProps) {
  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? 'default' : 'ghost',
          size: 'icon-sm',
        }),
        className
      )}
      type={type}
      {...props}
    />
  )
}

export { Pagination, PaginationContent, PaginationItem, PaginationLink }
