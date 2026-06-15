'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Button, Text } from '@polar-sh/orbit'
import { Checkbox } from '@polar-sh/orbit'
import { useMemo, type MouseEvent, type ReactNode } from 'react'

interface OptionGroup<T extends string> {
  key: string
  label: string
  options: T[]
}

const UNGROUPED_KEY = '__ungrouped__'

const humanize = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

const buildGroups = <T extends string>(
  options: readonly T[],
  separator: string,
): OptionGroup<T>[] => {
  const groupsByKey = new Map<string, OptionGroup<T>>()

  for (const option of options) {
    const separatorIndex = option.indexOf(separator)
    const key =
      separatorIndex === -1 ? UNGROUPED_KEY : option.slice(0, separatorIndex)

    let group = groupsByKey.get(key)
    if (!group) {
      group = {
        key,
        label: key === UNGROUPED_KEY ? 'General' : humanize(key),
        options: [],
      }
      groupsByKey.set(key, group)
    }
    group.options.push(option)
  }

  return Array.from(groupsByKey.values())
    .map((group) => ({
      ...group,
      options: group.options.sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => {
      if (a.key === UNGROUPED_KEY) return -1
      if (b.key === UNGROUPED_KEY) return 1
      return a.label.localeCompare(b.label)
    })
}

interface TreeMultiSelectProps<T extends string> {
  options: readonly T[]
  value: T[]
  onChange: (next: T[]) => void
  title?: ReactNode
  separator?: string
  renderOptionSuffix?: (option: T) => ReactNode
}

export function TreeMultiSelect<T extends string>({
  options,
  value,
  onChange,
  title,
  separator = ':',
  renderOptionSuffix,
}: TreeMultiSelectProps<T>) {
  const groups = useMemo(
    () => buildGroups(options, separator),
    [options, separator],
  )

  const selected = useMemo(() => new Set(value), [value])
  const allSelected =
    options.length > 0 && options.every((o) => selected.has(o))

  const setOptions = (next: Iterable<T>) => onChange(Array.from(next))

  const onToggleAll = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setOptions(allSelected ? [] : options)
  }

  const onToggleOption = (option: T) => {
    const next = new Set(selected)
    if (next.has(option)) next.delete(option)
    else next.add(option)
    setOptions(next)
  }

  const onToggleGroup = (group: OptionGroup<T>) => {
    const next = new Set(selected)
    const fullySelected = group.options.every((o) => next.has(o))
    for (const option of group.options) {
      if (fullySelected) next.delete(option)
      else next.add(option)
    }
    setOptions(next)
  }

  return (
    <Box flexDirection="column">
      <Box alignItems="center" justifyContent="between" columnGap="m">
        {title ? <Text variant="label">{title}</Text> : <span />}
        <Button onClick={onToggleAll} variant="secondary" size="sm">
          {allSelected ? 'Unselect all' : 'Select all'}
        </Button>
      </Box>

      <Box flexDirection="column" rowGap="xs">
        {groups.map((group) => {
          const selectedCount = group.options.filter((o) =>
            selected.has(o),
          ).length
          const groupChecked =
            selectedCount === 0
              ? false
              : selectedCount === group.options.length
                ? true
                : 'indeterminate'

          return (
            <Box key={group.key} flexDirection="column">
              <Box
                as="label"
                display="flex"
                alignItems="center"
                columnGap="s"
                paddingVertical="xs"
                cursor={{ hover: 'pointer' }}
              >
                <Checkbox
                  checked={groupChecked}
                  onCheckedChange={() => onToggleGroup(group)}
                />
                <Text monospace>{group.label}</Text>
              </Box>

              <Box flexDirection="column" pl="xl">
                {group.options.map((option) => (
                  <Box
                    key={option}
                    as="label"
                    display="flex"
                    alignItems="center"
                    columnGap="s"
                    paddingVertical="xs"
                    cursor={{ hover: 'pointer' }}
                  >
                    <Checkbox
                      checked={selected.has(option)}
                      onCheckedChange={() => onToggleOption(option)}
                    />
                    <Text monospace>{option}</Text>
                    {renderOptionSuffix?.(option)}
                  </Box>
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
