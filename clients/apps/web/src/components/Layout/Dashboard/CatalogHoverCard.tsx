'use client'

import { kinds } from '@/app/(main)/dashboard/[organization]/(header)/products/versions/VersionsTab'
import {
  ICON_CLASS,
  ITEM_CLASS,
  ITEM_HOVER_CLASS,
} from '@/components/Shared/Toolbar/ToolbarFilterMenu'
import { useCatalogConfig } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { CircleCheck, History, LockOutlined } from '@polar-sh/orbit/icons'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type Organization = schemas['Organization']
type Catalog = schemas['Catalog']

const MUTED_CLASS = 'dark:text-polar-500 text-gray-500'
const GLYPH_CLASS = twMerge(ICON_CLASS, 'flex items-center justify-center')

export const versionsHref = (organization: Organization, catalog?: Catalog) =>
  `/dashboard/${organization.slug}/products/versions${catalog ? `/${catalog.id}` : ''}`

export const DraftGlyph = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    aria-hidden
    className="shrink-0"
  >
    <circle
      cx="7"
      cy="7"
      r="5.75"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray="2.6 2"
    />
  </svg>
)

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

export const DraftContents = ({
  organization,
  draft,
}: {
  organization: Organization
  draft: Catalog
}) => {
  const { data } = useCatalogConfig(organization.id, draft.id)
  if (!data) {
    return null
  }
  const { products, benefits, meters } = data.config
  return (
    <span className={twMerge(MUTED_CLASS, 'min-w-0 truncate')}>
      {[
        plural(products.length, 'product'),
        plural(benefits.length, 'benefit'),
        meters.length ? plural(meters.length, 'meter') : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </span>
  )
}

const DraftChanges = ({
  organization,
  draft,
}: {
  organization: Organization
  draft: Catalog
}) => {
  const { changes } = draft
  if (!changes) {
    return <DraftContents organization={organization} draft={draft} />
  }
  const shown = kinds.filter(({ change }) => changes[`${change}_count`])
  if (!shown.length) {
    return <span className={MUTED_CLASS}>No changes</span>
  }
  return (
    <span className="flex shrink-0 gap-2 font-mono text-xs">
      {shown.map(({ change, glyph, color }) => (
        <Box key={change} as="span" color={color}>
          {glyph}
          {changes[`${change}_count`]}
        </Box>
      ))}
    </span>
  )
}

const Row = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className={twMerge(ITEM_CLASS, ITEM_HOVER_CLASS)}>
    {children}
  </Link>
)

const TimeAgo = ({ date }: { date: string }) => (
  <span className={twMerge(MUTED_CLASS, 'ml-auto shrink-0')}>
    <PolarTimeAgo date={new Date(date)} />
  </span>
)

export const CatalogHoverCard = ({
  organization,
  live,
  draft,
}: {
  organization: Organization
  live: Catalog | null | undefined
  draft: Catalog | null | undefined
}) => (
  <div className="flex w-[300px] flex-col">
    <div className="p-1.5">
      <div
        className={twMerge(ITEM_CLASS, MUTED_CLASS, 'cursor-default text-xs')}
      >
        <span className="grow">Catalog</span>
        <span className="flex items-center gap-1">
          <LockOutlined fontSize="inherit" />
          Managed in code
        </span>
      </div>
      {draft ? (
        <Row href={versionsHref(organization, draft)}>
          <span className={GLYPH_CLASS}>
            <DraftGlyph size={14} />
          </span>
          <span className="max-w-1/2 shrink-0 truncate">
            {draft.name ?? 'Draft'}
          </span>
          <DraftChanges organization={organization} draft={draft} />
          <TimeAgo date={draft.modified_at ?? draft.created_at} />
        </Row>
      ) : null}
      {live ? (
        <Row href={versionsHref(organization, live)}>
          <span className={GLYPH_CLASS}>
            <CircleCheck />
          </span>
          <span className="truncate">{live.name ?? 'Untitled'}</span>
          <span className="sr-only">Current</span>
          <TimeAgo date={live.published_at ?? live.created_at} />
        </Row>
      ) : (
        <p className={twMerge(MUTED_CLASS, 'px-2 py-1.5')}>
          Nothing is live yet. Checkouts open once you publish.
        </p>
      )}
    </div>
    <div className="dark:border-polar-700 border-t border-gray-200 p-1.5">
      <Row href={versionsHref(organization)}>
        <span className={GLYPH_CLASS}>
          <History />
        </span>
        All versions
      </Row>
    </div>
  </div>
)
