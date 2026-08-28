'use client'

import { ChipSelect } from '@/components/Form/ChipSelect'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export interface ExportColumnGroup<T extends string> {
  readonly label: string
  readonly columns: readonly { readonly value: T; readonly label: string }[]
}

export interface ExportColumnConfig<T extends string> {
  groups: readonly ExportColumnGroup<T>[]
  all: T[]
  labels: Record<T, string>
  defaults: T[]
  order: (selected: T[]) => T[]
  isDefault: (selected: T[]) => boolean
  summarize: (selected: T[]) => string
}

interface ExportColumnsProps<T extends string> {
  config: ExportColumnConfig<T>
  selected: T[]
  onChange: (columns: T[]) => void
}

export function ExportColumns<T extends string>({
  config,
  selected,
  onChange,
}: ExportColumnsProps<T>) {
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
        const groupValues: T[] = group.columns.map((column) => column.value)
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
                  ...(next as T[]),
                ])
              }
            />
          </Box>
        )
      })}
    </Box>
  )
}
