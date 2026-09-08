'use client'

import { schemas } from '@polar-sh/client'
import { Avatar, Switch, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useRef, useState } from 'react'

type AccessMode = 'all' | 'specific'

export interface OrganizationSelection {
  mode: AccessMode
  count: number
}

const OrganizationSelector = ({
  organizations,
  singleSelect = false,
  onValidityChange,
  onSelectionChange,
}: {
  organizations: schemas['AuthorizeOrganization'][]
  // sub_type=organization issues a user token forced to one org: lock to
  // "specific", pick exactly one with radios, and require a selection.
  singleSelect?: boolean
  onValidityChange?: (valid: boolean) => void
  onSelectionChange?: (selection: OrganizationSelection) => void
}) => {
  const [mode, setMode] = useState<AccessMode>(
    singleSelect ? 'specific' : 'all',
  )
  // A single radio option leaves nothing to choose, so preselect it.
  const [selected, setSelected] = useState<Set<string>>(() =>
    singleSelect && organizations.length === 1
      ? new Set([organizations[0].id])
      : new Set(),
  )
  // "All" is always valid; "specific" (and single-select) requires a selection.
  const report = (nextMode: AccessMode, nextSelected: Set<string>) => {
    onValidityChange?.(nextMode === 'all' || nextSelected.size > 0)
    onSelectionChange?.({ mode: nextMode, count: nextSelected.size })
  }

  // Sync the initial state up on mount. Subsequent changes report
  // synchronously from the handlers, so the parent re-renders in the same pass
  // instead of a frame later through an effect.
  const initialReport = useRef(report)
  useEffect(() => {
    initialReport.current(mode, selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const change = (nextMode: AccessMode, nextSelected: Set<string>) => {
    setMode(nextMode)
    setSelected(nextSelected)
    report(nextMode, nextSelected)
  }

  const select = (id: string) => {
    if (singleSelect) {
      change('specific', new Set([id]))
      return
    }
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    change('specific', next)
  }

  const selectAll = () => {
    change('all', new Set())
  }

  return (
    <Box as="section" flexDirection="column" rowGap="m" marginBottom="l">
      {!singleSelect && organizations.length > 0 && (
        <>
          <Box
            as="label"
            display="flex"
            alignItems="center"
            columnGap="m"
            paddingHorizontal="m"
            paddingVertical="m"
            borderRadius="m"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor={{ hover: 'background-secondary' }}
            transitionProperty="colors"
            transitionDuration="fast"
            cursor={{ hover: 'pointer' }}
          >
            <Text>All current and future organizations</Text>
            <Box marginLeft="auto">
              <Switch
                checked={mode === 'all'}
                onCheckedChange={(checked) => checked && selectAll()}
              />
            </Box>
          </Box>
          <Text variant="caption" color="muted" align="center">
            or select specific organizations
          </Text>
        </>
      )}

      {organizations.length > 0 && (
        <Box
          flexDirection="column"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          overflow="hidden"
          opacity={!singleSelect && mode === 'all' ? 0.8 : 1}
          transitionProperty="opacity"
          transitionDuration="fast"
        >
          {organizations.map((organization, index) => (
            <Box
              as="label"
              key={organization.id}
              display="flex"
              alignItems="center"
              columnGap="m"
              paddingHorizontal="m"
              paddingVertical="m"
              borderTopWidth={index === 0 ? 0 : 1}
              borderStyle="solid"
              borderColor="border-primary"
              backgroundColor={{ hover: 'background-secondary' }}
              transitionProperty="colors"
              transitionDuration="fast"
              cursor={{ hover: 'pointer' }}
            >
              <Avatar
                className="h-8 w-8"
                avatar_url={organization.avatar_url}
                name={organization.slug}
              />
              <Text>{organization.slug}</Text>
              <Box marginLeft="auto">
                {singleSelect ? (
                  <input
                    type="radio"
                    name="organizations"
                    value={organization.id}
                    checked={selected.has(organization.id)}
                    onChange={() => select(organization.id)}
                    className="h-4 w-4 accent-black dark:accent-white"
                  />
                ) : (
                  <Switch
                    name="organizations"
                    value={organization.id}
                    checked={selected.has(organization.id)}
                    onCheckedChange={() => select(organization.id)}
                  />
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default OrganizationSelector
