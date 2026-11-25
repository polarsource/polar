import { Text } from '@polar-sh/orbit'
import {
  CircleUserRound,
  FileText,
  Funnel,
  Gift,
  Package,
  Percent,
  RefreshCw,
} from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { EntityLinkMenu, type EntityLinkMenuItem } from './EntityLinkMenu'

export type EntityKind =
  | 'product'
  | 'customer'
  | 'discount'
  | 'subscription'
  | 'order'
  | 'benefit'
  // Not a page of its own: a list narrowed down to what shares the value.
  | 'filter'

// Each kind has its own mark, which takes its color while pointed at.
const ENTITIES: Record<EntityKind, { icon: typeof Package; hover: string }> = {
  product: {
    icon: Package,
    hover:
      'group-hover/entity:text-amber-500 dark:group-hover/entity:text-amber-400',
  },
  customer: {
    icon: CircleUserRound,
    hover:
      'group-hover/entity:text-blue-500 dark:group-hover/entity:text-blue-400',
  },
  discount: {
    icon: Percent,
    hover:
      'group-hover/entity:text-emerald-500 dark:group-hover/entity:text-emerald-400',
  },
  subscription: {
    icon: RefreshCw,
    hover:
      'group-hover/entity:text-indigo-500 dark:group-hover/entity:text-indigo-400',
  },
  order: {
    icon: FileText,
    hover:
      'group-hover/entity:text-indigo-500 dark:group-hover/entity:text-indigo-400',
  },
  filter: {
    icon: Funnel,
    hover:
      'group-hover/entity:text-gray-950 dark:group-hover/entity:text-white',
  },
  benefit: {
    icon: Gift,
    hover:
      'group-hover/entity:text-purple-500 dark:group-hover/entity:text-purple-400',
  },
}

// The padding is pulled back out, so the mark lines up with text around it
// and only the highlight reaches past.
export const ENTITY_CHIP_CLASS =
  'group/entity dark:hover:bg-polar-800 -mx-1.5 inline-flex w-fit max-w-full min-w-0 items-center rounded-md hover:bg-gray-100'
const LINK_CLASS = 'inline-flex min-w-0 items-center gap-2 py-0.5 pl-1.5'
const ICON_CLASS =
  'dark:text-polar-500 size-4 shrink-0 text-gray-400 transition-colors'

// A link to something that has a page of its own: the mark of what it is,
// then its name. Given menu items, an arrow after the name opens them.
export const EntityLink = ({
  kind,
  href,
  menuItems,
  children,
}: {
  kind: EntityKind
  href: string
  menuItems?: EntityLinkMenuItem[]
  children: ReactNode
}) => {
  const { icon: Icon, hover } = ENTITIES[kind]
  const hasMenu = menuItems != null && menuItems.length > 0
  return (
    <span className={ENTITY_CHIP_CLASS}>
      <Link
        href={href}
        className={`${LINK_CLASS} ${hasMenu ? 'pr-1' : 'pr-1.5'}`}
      >
        <Icon className={`${ICON_CLASS} ${hover}`} aria-hidden />
        <Text as="span" truncate>
          {children}
        </Text>
      </Link>
      {hasMenu && <EntityLinkMenu items={menuItems} />}
    </span>
  )
}
