'use client'

import { ChipSelect } from '@/components/Form/ChipSelect'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export interface ExportColumnGroup<C extends string> {
  readonly label: string
  readonly columns: readonly { readonly value: C; readonly label: string }[]
}

export interface ExportColumnConfig<C extends string> {
  groups: readonly ExportColumnGroup<C>[]
  all: C[]
  labels: Record<C, string>
  defaults: C[]
  order: (selected: C[]) => C[]
  isDefault: (selected: C[]) => boolean
  summarize: (selected: C[]) => string
}

export function createExportColumnConfig<C extends string>(
  groups: readonly ExportColumnGroup<C>[],
  defaults: C[],
): ExportColumnConfig<C> {
  const all: C[] = groups.flatMap((group) =>
    group.columns.map((column) => column.value),
  )

  const labels = Object.fromEntries(
    groups.flatMap((group) =>
      group.columns.map((column) => [column.value, column.label]),
    ),
  ) as Record<C, string>

  const order = (selected: C[]): C[] =>
    all.filter((column) => selected.includes(column))

  const isDefault = (selected: C[]): boolean =>
    selected.length === defaults.length &&
    defaults.every((column) => selected.includes(column))

  const summarize = (selected: C[]): string => {
    if (selected.length === 0) return 'No fields selected'
    if (selected.length === all.length) return 'All fields'
    const ordered = order(selected)
    const shown = ordered
      .slice(0, 3)
      .map((column) => labels[column])
      .join(', ')
    return ordered.length > 3 ? `${shown} +${ordered.length - 3}` : shown
  }

  return { groups, all, labels, defaults, order, isDefault, summarize }
}

interface ExportColumnsProps<C extends string> {
  config: ExportColumnConfig<C>
  selected: C[]
  onChange: (columns: C[]) => void
}

export function ExportColumns<C extends string>({
  config,
  selected,
  onChange,
}: ExportColumnsProps<C>) {
  const allSelected = selected.length === config.all.length
  const isDefault = config.isDefault(selected)

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between" columnGap="l">
        <Text variant="caption" color="muted">
          {selected.length} of {config.all.length} selected
        </Text>
        <Box alignItems="center" columnGap="xs">
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              className="dark:text-polar-500 dark:hover:text-polar-300 h-7 px-2 text-xs font-normal text-gray-500 hover:text-gray-900"
              onClick={() => onChange(config.defaults)}
            >
              Reset
            </Button>
          )}
          {!allSelected && (
            <Button
              variant="ghost"
              size="sm"
              className="dark:text-polar-500 dark:hover:text-polar-300 h-7 px-2 text-xs font-normal text-gray-500 hover:text-gray-900"
              onClick={() => onChange(config.all)}
            >
              Select all
            </Button>
          )}
        </Box>
      </Box>

      {config.groups.map((group) => {
        const groupValues: C[] = group.columns.map((column) => column.value)
        return (
          <Box key={group.label} flexDirection="column" rowGap="s">
            <Text variant="label" color="muted">
              {group.label}
            </Text>
            <ChipSelect
              options={[...group.columns]}
              selected={selected.filter((column) =>
                groupValues.includes(column),
              )}
              onChange={(next) =>
                onChange([
                  ...selected.filter((column) => !groupValues.includes(column)),
                  ...(next as C[]),
                ])
              }
            />
          </Box>
        )
      })}
    </Box>
  )
}
