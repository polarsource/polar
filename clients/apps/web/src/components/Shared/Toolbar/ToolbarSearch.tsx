import { useDebouncedCallback } from '@/hooks/utils'
import { Input } from '@polar-sh/orbit'
import { Search } from '@polar-sh/orbit/icons'

const SEARCH_DELAY = 300

interface ToolbarSearchProps {
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
}

// Free text applied as the list's `query`. What it matches is up to each list
// endpoint, so the placeholder says.
export const ToolbarSearch = ({
  value,
  onChange,
  placeholder,
}: ToolbarSearchProps) => {
  const commit = useDebouncedCallback(
    (text: string) => onChange(text.trim() || null),
    SEARCH_DELAY,
  )

  return (
    <Input
      type="search"
      aria-label="Search"
      className="h-8 w-56 rounded-full"
      preSlot={<Search className="size-4" />}
      placeholder={placeholder}
      defaultValue={value ?? ''}
      onChange={(event) => commit(event.target.value)}
    />
  )
}
