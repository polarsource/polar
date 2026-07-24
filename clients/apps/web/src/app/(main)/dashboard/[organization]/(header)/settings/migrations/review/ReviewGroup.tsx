import { Checkbox, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import {
  isImported,
  isSelectable,
  needsAttention,
  ReviewRow,
  rowStatus,
  selectableIds,
} from './reviewRows'

const GRID = '28px minmax(0, 1.6fr) minmax(0, 1fr) 84px minmax(0, 1.8fr)'

interface Props {
  title: string
  rows: ReviewRow[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleGroup: (ids: string[], select: boolean) => void
}

export function ReviewGroup({
  title,
  rows,
  selected,
  onToggle,
  onToggleGroup,
}: Props) {
  const groupSelectable = selectableIds(rows)
  const allOn =
    groupSelectable.length > 0 &&
    groupSelectable.every((id) => selected.has(id))
  const someOn = groupSelectable.some((id) => selected.has(id))
  const importCount = groupSelectable.filter((id) => selected.has(id)).length

  return (
    <Box
      flexDirection="column"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      overflow="hidden"
    >
      <Box
        display="grid"
        gridTemplateColumns={GRID}
        alignItems="center"
        columnGap="m"
        padding="m"
        backgroundColor="background-secondary"
      >
        <Checkbox
          checked={allOn ? true : someOn ? 'indeterminate' : false}
          disabled={groupSelectable.length === 0}
          onCheckedChange={() => onToggleGroup(groupSelectable, !allOn)}
          aria-label={`Select all ${title}`}
        />
        <Box gridColumn="2 / -1" alignItems="center" columnGap="s">
          <Text variant="body">{title}</Text>
          <Text variant="caption" color="muted">
            · {importCount} of {rows.length} importing
          </Text>
        </Box>
      </Box>

      {rows.map((row) => (
        <Row
          key={row.record_id ?? row.source_id}
          row={row}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
    </Box>
  )
}

function Row({
  row,
  selected,
  onToggle,
}: {
  row: ReviewRow
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  const status = rowStatus(row)
  const dim = row.status === 'skipped'
  return (
    <Box
      display="grid"
      gridTemplateColumns={GRID}
      alignItems="center"
      columnGap="m"
      padding="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <SelectCell row={row} selected={selected} onToggle={onToggle} />
      <Text variant="body" color={dim ? 'muted' : undefined}>
        {row.title}
      </Text>
      <Text variant="caption" color="muted">
        {row.subtitle ?? '—'}
      </Text>
      <Status status={status.label} color={status.color} size="small" />
      <Text variant="caption" color={needsAttention(row) ? 'warning' : 'muted'}>
        {row.reason ?? '—'}
      </Text>
    </Box>
  )
}

function SelectCell({
  row,
  selected,
  onToggle,
}: {
  row: ReviewRow
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (isImported(row)) {
    return (
      <Box color="text-secondary" aria-label={`${row.title} already imported`}>
        <Check size={16} aria-hidden="true" />
      </Box>
    )
  }
  if (!isSelectable(row) || !row.record_id) {
    return <Checkbox checked={false} disabled aria-label="Not importable" />
  }
  const id = row.record_id
  return (
    <Checkbox
      checked={selected.has(id)}
      onCheckedChange={() => onToggle(id)}
      aria-label={`Select ${row.title}`}
    />
  )
}
