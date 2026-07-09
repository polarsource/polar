'use client'

import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { ReviewGroup } from './ReviewGroup'
import {
  entityLabelPlural,
  groupRows,
  ReviewRow,
  selectableIds,
} from './reviewRows'

export interface ImportSummary {
  results: { entity: string; imported: number }[]
}

interface Props {
  rows: ReviewRow[]
  onImport: (recordIds: string[]) => void
  eyebrow?: string
  importing?: boolean
  importResult?: ImportSummary | null
  importError?: boolean
  onRerunPrecheck?: () => void
  rerunning?: boolean
}

export function ReviewTableView({
  rows,
  onImport,
  eyebrow,
  importing = false,
  importResult,
  importError = false,
  onRerunPrecheck,
  rerunning = false,
}: Props) {
  // Every importable row is selected by default; we track only the rows the
  // merchant explicitly turned off, so selection derives from the data with no
  // seeding effect — imported rows drop out on their own after a refetch.
  const [deselected, setDeselected] = useState<Set<string>>(new Set())
  const selectable = selectableIds(rows)
  const selectedIds = selectable.filter((id) => !deselected.has(id))
  const selected = new Set(selectedIds)

  const toggle = (id: string) =>
    setDeselected((prev) => toggleIn(prev, [id], !prev.has(id)))
  const toggleGroup = (ids: string[], select: boolean) =>
    setDeselected((prev) => toggleIn(prev, ids, select))

  const skippedCount = rows.filter((row) => row.status === 'skipped').length
  const allImported = rows.length > 0 && selectable.length === 0

  return (
    <Box as="section" flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="xs">
        <Box alignItems="center" justifyContent="between" columnGap="m">
          <Box flexDirection="column" rowGap="xs">
            {eyebrow && (
              <Text variant="caption" color="muted">
                {eyebrow}
              </Text>
            )}
            <Text variant="heading-xs" as="h3">
              Review &amp; import
            </Text>
          </Box>
          {onRerunPrecheck && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRerunPrecheck}
              disabled={rerunning}
            >
              {rerunning ? 'Re-checking…' : 'Re-run pre-check'}
            </Button>
          )}
        </Box>
        <Box maxWidth={680}>
          <Text variant="caption" color="muted">
            Pick what to bring to Polar. Subscriptions come over paused, so no
            one is billed until cutover. Anything you leave out stays pending
            and can be imported later.
          </Text>
        </Box>
      </Box>

      {importResult && !allImported && (
        <Alert
          variant="success"
          title="Catalog imported"
          description={importResultText(importResult)}
        />
      )}
      {importError && (
        <Alert
          variant="danger"
          title="We couldn't import the catalog"
          description="Something went wrong. Please try again."
        />
      )}

      {rows.length === 0 ? (
        <Text variant="caption" color="muted">
          No records staged yet. Use &ldquo;Re-run pre-check&rdquo; to scan
          Stripe.
        </Text>
      ) : allImported ? (
        <Alert
          variant="success"
          title="Catalog imported"
          description="All importable records are in Polar. Next: move saved cards."
        />
      ) : (
        <Box flexDirection="column" rowGap="l">
          <SelectionBar
            count={selectedIds.length}
            total={selectable.length}
            skipped={skippedCount}
            disabled={selectedIds.length === 0 || importing}
            pending={importing}
            onClear={() => setDeselected(new Set(selectable))}
            onImport={() => onImport(selectedIds)}
          />
          {groupRows(rows).map((group) => (
            <ReviewGroup
              key={group.entity}
              title={entityLabelPlural(group.entity)}
              rows={group.rows}
              selected={selected}
              onToggle={toggle}
              onToggleGroup={toggleGroup}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

function toggleIn(
  set: Set<string>,
  ids: string[],
  select: boolean,
): Set<string> {
  const next = new Set(set)
  // `deselected` tracks turned-off rows, so selecting removes and vice versa.
  ids.forEach((id) => (select ? next.delete(id) : next.add(id)))
  return next
}

function SelectionBar({
  count,
  total,
  skipped,
  disabled,
  pending,
  onClear,
  onImport,
}: {
  count: number
  total: number
  skipped: number
  disabled: boolean
  pending: boolean
  onClear: () => void
  onImport: () => void
}) {
  return (
    <Box
      alignItems="center"
      justifyContent="between"
      columnGap="m"
      padding="m"
      borderRadius="m"
      backgroundColor="background-secondary"
    >
      <Text variant="caption" color="muted">
        {count} of {total} selected
        {skipped > 0 ? ` · ${skipped} stay on Stripe` : ''}
      </Text>
      <Box alignItems="center" columnGap="s">
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={count === 0}
        >
          Deselect all
        </Button>
        <Button size="sm" onClick={onImport} disabled={disabled}>
          {pending
            ? 'Importing…'
            : count > 0
              ? `Import ${count} selected`
              : 'Import selected'}
        </Button>
      </Box>
    </Box>
  )
}

function importResultText(report: ImportSummary): string {
  const byEntity = new Map(
    report.results.map((result) => [result.entity, result.imported]),
  )
  const parts = [
    plural(byEntity.get('subscriptions') ?? 0, 'subscription'),
    plural(byEntity.get('products') ?? 0, 'product'),
    plural(byEntity.get('customers') ?? 0, 'customer'),
  ].filter((part) => part !== null)
  if (parts.length === 0) return 'No new records to import.'
  return `Imported ${parts.join(', ')} into Polar.`
}

function plural(count: number, noun: string): string | null {
  if (count === 0) return null
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
