import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { getPageNumbers } from '@/lib/utils.ts';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'



interface Props {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}

export function ArticlePagination({ page, total, pageSize, onChange }: Props) {
  const totalPages = Math.ceil(total / pageSize)
  const pages = getPageNumbers(page, totalPages)
  if (totalPages <= 1) return null

  return (
    <Pagination className="justify-start">
      <PaginationContent className="gap-2">
        <PaginationItem>
          <PaginationLink
            className="cursor-pointer h-8 min-w-8 px-1"
            onClick={() => onChange(1)}
            aria-disabled={page === 1}
          >
            «
          </PaginationLink>
        </PaginationItem>

        <PaginationItem>
          <PaginationLink className="cursor-pointer h-8 min-w-8 px-1" onClick={() => onChange(Math.max(1, page - 1))} >
            <ChevronLeftIcon />
          </PaginationLink>
        </PaginationItem>
        {pages.map((p, i) => (
          <PaginationItem key={i}>
            {p === '...' ? (
              <span className='px-3 text-muted-foreground'>…</span>
            ) : (
              <PaginationLink
                className="cursor-pointer h-8 min-w-8 px-1"
                isActive={p === page}
                onClick={() => onChange(p as number)}
              >
                {p}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationLink
            className="cursor-pointer h-8 min-w-8 px-1"
            onClick={() => onChange(Math.min(totalPages, page + 1))}
          >
            <ChevronRightIcon />
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            className="cursor-pointer h-8 min-w-8 px-1"
            onClick={() => onChange(totalPages)}
            aria-disabled={page === totalPages}
          >
            »
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
