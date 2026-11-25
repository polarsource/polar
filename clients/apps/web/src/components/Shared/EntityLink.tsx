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
import { twMerge } from 'tailwind-merge'
import {
  EntityLinkMenu,
  type EntityLinkMenuItem,
  type EntityMenuAction,
} from './EntityLinkMenu'

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
// and only the highlight reaches past. It stays lit while its menu is open.
// The width limit counts the pulled-back padding, or a chip that fills its
// container would be cut short of its own text.
export const ENTITY_CHIP_CLASS =
  'group/entity dark:hover:bg-polar-800 -mx-1.5 inline-flex w-fit max-w-[calc(100%+0.75rem)] min-w-0 items-center rounded-md hover:bg-gray-100 has-[[data-state=open]]:bg-gray-100 dark:has-[[data-state=open]]:bg-polar-800'
const LINK_CLASS = 'inline-flex min-w-0 items-center gap-2 py-0.5 pl-1.5'
const ICON_CLASS =
  'dark:text-polar-500 size-4 shrink-0 text-gray-400 transition-colors'

// A link to something that has a page of its own: the mark of what it is,
// then its name. Given menu items, an arrow after the name opens them.
export const EntityLink = ({
  kind,
  href,
  menuItems,
  minimal = false,
  muted = false,
  secondary,
  children,
}: {
  kind: EntityKind
  href: string
  menuItems?: EntityLinkMenuItem[]
  // Leaves the mark out, where the column already says what the name is.
  minimal?: boolean
  // For a name that is secondary to the one beside it.
  muted?: boolean
  // Said after the name, and part of the same link. It gives way first when
  // the two do not fit.
  secondary?: string
  children: ReactNode
}) => {
  const { icon: Icon, hover } = ENTITIES[kind]
  const hasMenu = menuItems != null && menuItems.length > 0
  return (
    // A click on the link or its menu is not one on the row around it.
    <span
      className={ENTITY_CHIP_CLASS}
      onClick={(event) => event.stopPropagation()}
    >
      <Link
        href={href}
        className={`${LINK_CLASS} ${hasMenu ? 'pr-1' : 'pr-1.5'}`}
      >
        {!minimal && <Icon className={`${ICON_CLASS} ${hover}`} aria-hidden />}
        <Text as="span" color={muted ? 'muted' : 'default'} truncate>
          {children}
        </Text>
        {secondary && (
          <span className="flex min-w-0 shrink-[4]">
            <Text as="span" color="muted" truncate>
              {secondary}
            </Text>
          </span>
        )}
      </Link>
      {hasMenu && <EntityLinkMenu items={menuItems} />}
    </span>
  )
}

export interface CombinedEntity {
  kind: EntityKind
  href: string
  name: string
  menuItems?: EntityMenuAction[]
  // For a name that is secondary to the one before it.
  muted?: boolean
}

// Two things that belong together on one line, as one chip: each name is its
// own link, without a mark, and one arrow at the end opens a menu that keeps
// what can be done with each under its name.
export const CombinedEntityLink = ({
  entities,
}: {
  entities: [CombinedEntity, CombinedEntity]
}) => {
  const menuItems = entities
    .map(({ kind, name, menuItems = [] }, index) => {
      const { icon: Icon } = ENTITIES[kind]
      // Keyed by place, as the two can share a name or a kind.
      return {
        key: `${kind}-${index}`,
        label: name,
        icon: <Icon />,
        items: menuItems,
      }
    })
    .filter(({ items }) => items.length > 0)
  const [first, second] = entities
  return (
    <span
      className={twMerge(ENTITY_CHIP_CLASS, 'gap-2 pl-1.5')}
      onClick={(event) => event.stopPropagation()}
    >
      <Link href={first.href} className="flex min-w-0 py-0.5">
        <Text as="span" color={first.muted ? 'muted' : 'default'} truncate>
          {first.name}
        </Text>
      </Link>
      <Link
        href={second.href}
        className="flex max-w-[45%] min-w-0 shrink-0 py-0.5"
      >
        <Text as="span" color={second.muted ? 'muted' : 'default'} truncate>
          {second.name}
        </Text>
      </Link>
      {menuItems.length > 0 ? (
        <EntityLinkMenu items={menuItems} />
      ) : (
        <span className="w-0.5" />
      )}
    </span>
  )
}
