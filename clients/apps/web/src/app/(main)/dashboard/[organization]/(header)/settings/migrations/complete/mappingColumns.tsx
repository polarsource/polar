import { DataTableColumnDef, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { polarResourceHref, STATE_LABELS, STATE_TONES } from './completeCopy'
import { MappingRow, MappingState } from './idMapping'

const STAYED_ON_STRIPE = new Set<MappingState>([
  'not_imported',
  'left_on_stripe',
  'failed',
])

const STATUS_COLORS = {
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  muted: 'gray',
} as const

export function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      columnGap="xs"
      minWidth={0}
      cursor={{ hover: 'pointer' }}
      color={{ base: 'text-primary', hover: 'text-secondary' }}
      title="Copy"
      onClick={(event) => {
        event.stopPropagation()
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      <Text variant="caption" monospace truncate color="inherit">
        {value}
      </Text>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </Box>
  )
}

export function MappingStatus({ row }: { row: MappingRow }) {
  return (
    <Status
      status={STATE_LABELS[row.state]}
      color={STATUS_COLORS[STATE_TONES[row.state]]}
      size="small"
    />
  )
}

export function PolarIdCell({
  row,
  organizationSlug,
}: {
  row: MappingRow
  organizationSlug: string
}) {
  if (!row.polarId) {
    return (
      <Text variant="caption" color="muted">
        {STAYED_ON_STRIPE.has(row.state) ? 'Stayed on Stripe' : 'Not found'}
      </Text>
    )
  }
  const href = polarResourceHref(organizationSlug, row)
  return (
    <Box alignItems="center" columnGap="s" minWidth={0}>
      <CopyableId value={row.polarId} />
      {href && (
        <Link href={href} onClick={(event) => event.stopPropagation()}>
          <Box
            color={{ base: 'text-tertiary', hover: 'text-primary' }}
            title="Open in Polar"
          >
            <ArrowUpRight size={14} />
          </Box>
        </Link>
      )}
    </Box>
  )
}

export function buildMappingColumns(
  organizationSlug: string,
): DataTableColumnDef<MappingRow>[] {
  return [
    {
      id: 'name',
      size: 240,
      header: 'Name',
      cell: ({ row }) => (
        <Box flexDirection="column" minWidth={0}>
          <Text truncate>{row.original.label}</Text>
          {row.original.detail && (
            <Text variant="caption" color="muted" truncate>
              {row.original.detail}
            </Text>
          )}
        </Box>
      ),
    },
    {
      id: 'stripe',
      size: 240,
      header: 'Stripe ID',
      cell: ({ row }) => <CopyableId value={row.original.stripeId} />,
    },
    {
      id: 'polar',
      size: 330,
      header: 'Polar ID',
      cell: ({ row }) => (
        <PolarIdCell row={row.original} organizationSlug={organizationSlug} />
      ),
    },
    {
      id: 'status',
      size: 150,
      header: 'Status',
      cell: ({ row }) => <MappingStatus row={row.original} />,
    },
  ]
}
