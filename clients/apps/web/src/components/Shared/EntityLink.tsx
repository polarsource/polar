import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import {
  CircleUserRound,
  FileText,
  Gift,
  MessageCircle,
  Package,
  Percent,
  RefreshCw,
} from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { PANEL_CLASS } from './Toolbar/ToolbarFilterMenu'
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
  // Not a page of its own: the list narrowed down to what was cancelled for
  // the same reason.
  | 'reason'

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
  reason: {
    icon: MessageCircle,
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
// Long enough that moving across a list does not open a card on every row.
const PREVIEW_DELAY = 500
const PREVIEW_CLASS = twMerge(
  PANEL_CLASS,
  'origin-(--radix-tooltip-content-transform-origin) p-0 text-black dark:text-white',
)
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
  preview,
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
  // A card about the entity, shown while the link is pointed at. It is only
  // rendered once it opens, so it can load what it shows.
  preview?: ReactNode
  children: ReactNode
}) => {
  const { icon: Icon, hover } = ENTITIES[kind]
  const hasMenu = menuItems != null && menuItems.length > 0
  const link = (
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
  )
  return (
    // A click on the link or its menu is not one on the row around it.
    <span
      className={ENTITY_CHIP_CLASS}
      onClick={(event) => event.stopPropagation()}
    >
      {preview ? (
        <Tooltip delayDuration={PREVIEW_DELAY}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            sideOffset={8}
            className={PREVIEW_CLASS}
          >
            {preview}
          </TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
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
