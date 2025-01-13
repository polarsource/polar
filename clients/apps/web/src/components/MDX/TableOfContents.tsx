import { ArrowForward } from '@mui/icons-material'
import Link from 'next/link'
import type { TocItem } from 'remark-flexible-toc'
import { twMerge } from 'tailwind-merge'
import TableOfContentsScrollSpy from './TableOfContentsScrollSpy'

export const TableOfContents = ({
  items,
}: {
  items: TocItem[] | undefined
}) => {
  if (!items || items.length === 0) return null

  return (
    <div
      id="toc"
      className="right-8 flex w-full flex-shrink-0 flex-col md:sticky md:top-16 md:w-64"
    >
      <nav className="hidden w-full flex-col gap-y-4 md:flex">
        <h3 className="text-black dark:text-white">On this page</h3>
        <ul className="dark:border-polar-700 flex flex-col gap-y-2.5 border-l border-gray-200 pl-4 text-sm">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                id={`toc-entry-${item.href}`}
                href={item.href}
                className={twMerge(
                  'dark:text-polar-500 flex flex-row gap-x-2 leading-normal text-gray-500 transition-colors duration-200 ease-in-out hover:text-blue-500 dark:hover:text-white',
                  'aria-selected:text-blue-500 aria-selected:dark:text-white',
                )}
              >
                {item.depth > 2 && (
                  <ArrowForward className="mt-[4px]" fontSize="inherit" />
                )}
                {item.value}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <TableOfContentsScrollSpy />
    </div>
  )
}
