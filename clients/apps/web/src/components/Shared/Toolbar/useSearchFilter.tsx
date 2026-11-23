import { type Filter } from '@/components/Shared/FilterPopover'
import { Search } from '@polar-sh/orbit/icons'
import { useState } from 'react'

// Free text, typed in and applied as the list's `query`. What it matches is
// up to each list endpoint, so the placeholder says.
export const useSearchFilter = (
  value: string | null,
  onChange: (value: string | null) => void,
  placeholder: string,
): Filter => {
  const [draft, setDraft] = useState('')
  const text = draft.trim() || value

  return {
    key: 'query',
    label: 'Search',
    icon: <Search className="size-4" />,
    type: 'single',
    options: text ? [{ value: text, label: text }] : [],
    value,
    onChange,
    searchPlaceholder: placeholder,
    searchQuery: draft,
    onSearchQueryChange: setDraft,
    emptyLabel: 'Type to search',
  }
}
