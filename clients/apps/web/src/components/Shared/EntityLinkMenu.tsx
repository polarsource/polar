'use client'

import { type Filter } from '@/components/Shared/FilterPopover'
import { ToolbarFilterMenu } from '@/components/Shared/Toolbar/ToolbarFilterMenu'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { ArrowUpRight, Copy } from '@polar-sh/orbit/icons'
import { useRouter } from 'next/navigation'
import { type ReactNode } from 'react'

// What a menu item does: put a value on the clipboard, go somewhere, or run.
// A place to go can be worked out when it is picked.
export type EntityMenuAction = { label: string; icon?: ReactNode } & (
  | { copy: string }
  | { href: string | (() => string) }
  | { onSelect: () => void }
)

// An action, or a named set of them that opens beside the menu.
export type EntityLinkMenuItem =
  | EntityMenuAction
  | {
      label: string
      icon?: ReactNode
      items: EntityMenuAction[]
      // Tells two sets with the same label apart.
      key?: string
    }

const getIcon = (action: EntityMenuAction) => {
  if (action.icon) return action.icon
  if ('copy' in action) return <Copy />
  return 'href' in action ? <ArrowUpRight /> : null
}

// The menu behind the arrow of an entity link. It is the toolbar's filter
// menu: actions on top, then each set of actions as a property that opens to
// its options.
export const EntityLinkMenu = ({ items }: { items: EntityLinkMenuItem[] }) => {
  const router = useRouter()
  const safeCopy = useSafeCopy(toast)

  const run = (action: EntityMenuAction) => {
    if ('copy' in action) {
      safeCopy(action.copy).then(() => toast({ title: 'Copied to clipboard' }))
    } else if ('href' in action) {
      router.push(typeof action.href === 'string' ? action.href : action.href())
    } else {
      action.onSelect()
    }
  }

  const actions = items
    .filter((item): item is EntityMenuAction => !('items' in item))
    .map((action) => ({
      key: action.label,
      label: action.label,
      icon: getIcon(action),
      onSelect: () => run(action),
    }))
  const filters = items
    .filter((item) => 'items' in item)
    .map(
      (group): Filter => ({
        type: 'single',
        key: group.key ?? group.label,
        label: group.label,
        icon: group.icon,
        options: group.items.map((action, index) => ({
          value: String(index),
          label: action.label,
        })),
        value: null,
        selectable: false,
        onChange: (value) => {
          if (value !== null) run(group.items[Number(value)])
        },
      }),
    )

  return (
    <ToolbarFilterMenu variant="inline" actions={actions} filters={filters} />
  )
}
