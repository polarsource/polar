'use client'

import {
  EntityLinkMenu,
  type EntityLinkMenuItem,
} from '@/components/Shared/EntityLinkMenu'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { FileText, RefreshCw, ShoppingCart } from '@polar-sh/orbit/icons'
import { endOfDay, endOfToday, max, startOfDay } from 'date-fns'
import { useContext } from 'react'

type Range = { from: Date; to: Date }

// Ways to take a moment elsewhere: onto the clipboard, or into a list narrowed
// down to what happened around it.
export const TimestampMenu = ({ timestamp }: { timestamp: string }) => {
  const { organization } = useContext(OrganizationContext)
  const date = new Date(timestamp)
  const sales = `/dashboard/${organization.slug}/sales`

  const ranges: { label: string; get: () => Range }[] = [
    {
      label: 'on this day',
      get: () => ({ from: startOfDay(date), to: endOfDay(date) }),
    },
    {
      label: 'since this day',
      get: () => ({
        from: startOfDay(date),
        to: max([endOfToday(), endOfDay(date)]),
      }),
    },
    {
      label: 'up to this day',
      get: () => ({
        from: startOfDay(new Date(organization.created_at)),
        to: endOfDay(date),
      }),
    },
  ]
  const links = (verb: string, path: string, fromKey: string, toKey: string) =>
    ranges.map(({ label, get }) => ({
      label: `${verb} ${label}`,
      href: () => {
        const { from, to } = get()
        const query = new URLSearchParams({
          [fromKey]: from.toISOString(),
          [toKey]: to.toISOString(),
        })
        return `${path}${path.includes('?') ? '&' : '?'}${query}`
      },
    }))

  const items: EntityLinkMenuItem[] = [
    { label: 'Copy ISO timestamp', copy: date.toISOString() },
    {
      label: 'Copy Unix timestamp',
      copy: String(Math.floor(date.getTime() / 1000)),
    },
    {
      label: 'Subscriptions',
      icon: <RefreshCw />,
      items: links(
        'Started',
        `${sales}/subscriptions?view=list`,
        'started_after',
        'started_before',
      ),
    },
    {
      label: 'Orders',
      icon: <FileText />,
      items: links('Created', sales, 'startDate', 'endDate'),
    },
    {
      label: 'Checkouts',
      icon: <ShoppingCart />,
      items: links(
        'Created',
        `${sales}/checkouts`,
        'created_after',
        'created_before',
      ),
    },
  ]

  return <EntityLinkMenu items={items} />
}
