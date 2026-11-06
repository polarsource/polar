'use client'

import { schemas } from '@polar-sh/client'
import { parseAsString, useQueryState } from 'nuqs'
import { CostCustomerDetails } from './CostCustomerDetails'
import { CostPropertyDetails } from './CostPropertyDetails'
import { CostGroupBy, CostRange } from './costRanges'
import { CostTypeDetails } from './CostTypeDetails'
import { CostRow } from './useCostBreakdown'

export type CostSelectionKind = 'type' | 'customer' | 'model' | 'vendor'

const PUSH_HISTORY = { history: 'push' } as const

// One URL parameter per kind, so links can open a panel directly
// (`?type=<event type id>`, `?customer=<customer id>`, `?model=gpt-5`).
export const useCostSelection = () => {
  const [type, setType] = useQueryState(
    'type',
    parseAsString.withOptions(PUSH_HISTORY),
  )
  const [customer, setCustomer] = useQueryState(
    'customer',
    parseAsString.withOptions(PUSH_HISTORY),
  )
  const [model, setModel] = useQueryState(
    'model',
    parseAsString.withOptions(PUSH_HISTORY),
  )
  const [vendor, setVendor] = useQueryState(
    'vendor',
    parseAsString.withOptions(PUSH_HISTORY),
  )

  const selected: { kind: CostSelectionKind; value: string } | null = type
    ? { kind: 'type', value: type }
    : customer
      ? { kind: 'customer', value: customer }
      : model
        ? { kind: 'model', value: model }
        : vendor
          ? { kind: 'vendor', value: vendor }
          : null

  const select = (kind: CostSelectionKind | null, value: string | null) => {
    setType(kind === 'type' ? value : null)
    setCustomer(kind === 'customer' ? value : null)
    setModel(kind === 'model' ? value : null)
    setVendor(kind === 'vendor' ? value : null)
  }

  return { selected, select }
}

// The panel a row opens, if any: unattributed customers have nothing to show.
export const rowSelection = (
  row: CostRow,
  groupBy: CostGroupBy,
): { kind: CostSelectionKind; value: string } | null => {
  if (groupBy === 'type' && row.eventTypeId) {
    return { kind: 'type', value: row.eventTypeId }
  }
  if (groupBy === 'customer' && row.customerId) {
    return { kind: 'customer', value: row.customerId }
  }
  if (groupBy === 'model' || groupBy === 'vendor') {
    return { kind: groupBy, value: row.key }
  }
  return null
}

export const CostDetailView = ({
  organization,
  selected,
  range,
  customerIds,
  rows,
  onSelect,
}: {
  organization: schemas['Organization']
  selected: { kind: CostSelectionKind; value: string }
  range: CostRange
  customerIds: string[] | null
  rows: CostRow[]
  onSelect: (kind: CostSelectionKind | null, value: string | null) => void
}) => {
  const close = () => onSelect(null, null)

  switch (selected.kind) {
    case 'type':
      return (
        <CostTypeDetails
          key={selected.value}
          organization={organization}
          eventTypeId={selected.value}
          range={range}
          customerIds={customerIds}
          onClose={close}
        />
      )
    case 'customer':
      return (
        <CostCustomerDetails
          key={selected.value}
          organization={organization}
          customerId={selected.value}
          label={
            rows.find((row) => row.customerId === selected.value)?.label ?? null
          }
          range={range}
          onSelectEventType={(id) => onSelect('type', id)}
          onClose={close}
        />
      )
    default:
      return (
        <CostPropertyDetails
          key={`${selected.kind}:${selected.value}`}
          organization={organization}
          property={selected.kind}
          value={selected.value}
          row={rows.find((row) => row.key === selected.value) ?? null}
          range={range}
          customerIds={customerIds}
          onClose={close}
        />
      )
  }
}
