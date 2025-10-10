'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import Link from 'next/link'
import { ReactNode, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface NavPopoverSection {
  title?: string
  items: NavPopoverItem[]
}

export interface NavPopoverItem {
  href: string
  label: string
  subtitle?: string
  target?: '_blank'
}

interface NavPopoverProps {
  trigger: ReactNode
  sections: NavPopoverSection[]
  isActive?: boolean
  layout?: 'grid' | 'flex'
}

export const NavPopover = ({
  trigger,
  sections,
  isActive,
  layout = 'grid',
}: NavPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className={twMerge(
          'dark:text-polar-500 -m-1 flex cursor-pointer items-center gap-x-2 p-1 text-gray-500 transition-colors hover:text-black focus:outline-none dark:hover:text-white',
          (isOpen || isActive) && 'text-black dark:text-white',
        )}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        className={twMerge(
          'w-fit divide-x p-0',
          layout === 'flex'
            ? 'flex flex-row'
            : `grid ${sections.length === 1 ? 'grid-cols-1' : `grid-cols-${sections.length}`}`,
        )}
        sideOffset={0}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {sections.map((section, idx) => (
          <div
            key={idx}
            className={twMerge(
              'flex flex-col p-2',
              section.items.some((item) => item.subtitle) ? 'col-span-2' : '',
            )}
          >
            {section.title && (
              <h3 className="dark:text-polar-500 px-4 py-2 text-sm text-gray-500">
                {section.title}
              </h3>
            )}
            <div
              className={twMerge(
                section.items.some((item) => item.subtitle)
                  ? 'grid grid-cols-2'
                  : '',
              )}
            >
              {section.items.map(({ href, label, subtitle, target }) => (
                <Link
                  key={href + label}
                  href={href}
                  prefetch
                  target={target}
                  className="dark:hover:bg-polar-800 flex flex-col rounded-md px-4 py-2 text-sm transition-colors hover:bg-gray-100"
                >
                  <span className="font-medium">{label}</span>
                  {subtitle && (
                    <span className="dark:text-polar-500 text-gray-500">
                      {subtitle}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
