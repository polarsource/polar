'use client'

import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { ChevronDown } from '@polar-sh/orbit/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import Link from 'next/link'

// What a menu item does: put a value on the clipboard, go somewhere, or run.
export type EntityLinkMenuItem =
  | { label: string; copy: string }
  | { label: string; href: string }
  | { label: string; onSelect: () => void }

const TRIGGER_CLASS =
  'dark:text-polar-500 dark:hover:bg-polar-700 flex shrink-0 opacity-0 group-hover/entity:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 cursor-pointer items-center self-stretch rounded-md px-1 text-gray-400 hover:bg-gray-200 hover:text-gray-950 dark:hover:text-white'

export const EntityLinkMenu = ({ items }: { items: EntityLinkMenuItem[] }) => {
  const safeCopy = useSafeCopy(toast)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER_CLASS} aria-label="More actions">
        <ChevronDown className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) =>
          'href' in item ? (
            <DropdownMenuItem key={item.label} asChild>
              <Link href={item.href}>{item.label}</Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={item.label}
              onClick={() => {
                if ('copy' in item) {
                  safeCopy(item.copy).then(() =>
                    toast({ title: 'Copied to clipboard' }),
                  )
                } else {
                  item.onSelect()
                }
              }}
            >
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
