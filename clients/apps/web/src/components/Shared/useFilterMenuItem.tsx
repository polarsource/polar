'use client'

import { type EntityMenuAction } from '@/components/Shared/EntityLinkMenu'
import { Funnel } from '@polar-sh/orbit/icons'
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs'

const idsParser = parseAsArrayOf(parseAsString)

// The menu item that adds a value to a list's filter in the URL, for a list
// that filters by that key. Nothing once the value is already filtered by.
export const useFilterMenuItem = (
  key: string,
  value: string,
  label: string,
): EntityMenuAction[] => {
  const [values, setValues] = useQueryState(key, idsParser)
  return values?.includes(value)
    ? []
    : [
        {
          label,
          icon: <Funnel />,
          onSelect: () => setValues([...(values ?? []), value]),
        },
      ]
}
