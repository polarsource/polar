'use client'

import { DataTableColumnDef, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CurrentSelectCheckbox } from './CurrentSelectCheckbox'
import { IssueCode, MockSubscriptionRecord } from './mockData'
import {
  CATEGORY_LABELS,
  OWNER_LABELS,
  STATUS_LABELS,
  statusColor,
} from './recordLabels'
import { resolveBillingOwner } from './selectors'

export type HeaderCheckState = 'checked' | 'unchecked' | 'indeterminate'

const TOP_ISSUE_LABELS: Partial<Record<IssueCode, string>> = {
  customer_missing_country: 'Missing country',
  product_exists_in_polar: 'Existing Polar product',
  customer_stripe_id_conflict: 'Email identity conflict',
}

interface ColumnContext {
  isSelectable: (id: string) => boolean
  isSelected: (id: string) => boolean
  headerState: HeaderCheckState
  canSelectAll: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  showSelect?: boolean
  transferred?: boolean
}

export function buildCurrentColumns({
  isSelectable,
  isSelected,
  headerState,
  canSelectAll,
  onToggle,
  onToggleAll,
  showSelect = true,
  transferred = false,
}: ColumnContext): DataTableColumnDef<MockSubscriptionRecord>[] {
  const columns: DataTableColumnDef<MockSubscriptionRecord>[] = []

  if (showSelect) {
    columns.push({
      id: 'select',
      size: 44,
      header: () => (
        <CurrentSelectCheckbox
          checked={
            headerState === 'indeterminate'
              ? 'indeterminate'
              : headerState === 'checked'
          }
          disabled={!canSelectAll}
          ariaLabel="Select all ready"
          onToggle={onToggleAll}
        />
      ),
      cell: ({ row }) => (
        <SelectCell
          record={row.original}
          selectable={isSelectable(row.original.id)}
          selected={isSelected(row.original.id)}
          onToggle={() => onToggle(row.original.id)}
        />
      ),
    })
  }

  columns.push(
    {
      id: 'customer',
      size: 260,
      header: 'Customer',
      cell: ({ row }) => (
        <Box minWidth={0} flexDirection="column" rowGap="xs">
          <Text truncate>{row.original.customerLabel}</Text>
          <Text variant="caption" color="muted" truncate>
            {row.original.customerEmail ?? 'No email'}
          </Text>
        </Box>
      ),
    },
    {
      id: 'product',
      size: 160,
      header: 'Product',
      cell: ({ row }) => (
        <Box minWidth={0}>
          <Text truncate>{row.original.productName}</Text>
        </Box>
      ),
    },
    {
      id: 'import',
      size: 180,
      header: 'Import',
      cell: ({ row }) => <ImportCell record={row.original} />,
    },
    {
      id: 'status',
      size: 140,
      header: 'Status',
      cell: ({ row }) => (
        <Status
          status={STATUS_LABELS[row.original.status]}
          color={statusColor(row.original.status)}
          size="small"
        />
      ),
    },
    {
      id: 'billing',
      size: 110,
      header: 'Billing',
      cell: ({ row }) => {
        const owner = resolveBillingOwner(row.original, transferred)
        return (
          <Status
            status={OWNER_LABELS[owner]}
            color={owner === 'polar' ? 'green' : 'gray'}
            size="small"
          />
        )
      },
    },
  )

  return columns
}

function ImportCell({ record }: { record: MockSubscriptionRecord }) {
  const topLabel = TOP_ISSUE_LABELS[record.issueCode]
  if (record.category === 'clean') {
    return <Status status="Ready" color="gray" size="small" />
  }
  return (
    <Status
      status={topLabel ?? CATEGORY_LABELS[record.category]}
      color={topLabel ? 'yellow' : 'gray'}
      size="small"
    />
  )
}

function SelectCell({
  record,
  selectable,
  selected,
  onToggle,
}: {
  record: MockSubscriptionRecord
  selectable: boolean
  selected: boolean
  onToggle: () => void
}) {
  if (!selectable) {
    return (
      <CurrentSelectCheckbox
        checked={false}
        disabled
        ariaLabel={`${record.customerLabel} can't be selected`}
      />
    )
  }
  return (
    <CurrentSelectCheckbox
      checked={selected}
      ariaLabel={`Select ${record.customerLabel}`}
      onToggle={onToggle}
    />
  )
}
