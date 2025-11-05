'use client'

import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxProps<T> {
  // Data
  items: T[]
  value: string | null
  selectedItem: T | null

  // Callbacks
  onChange: (value: string | null) => void
  onQueryChange: (query: string) => void
  getItemValue: (item: T) => string
  getItemLabel: (item: T) => string

  // Optional customization
  renderItem?: (item: T) => React.ReactNode
  isLoading?: boolean

  // Text customization
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string

  // Styling
  className?: string
}

export function Combobox<T>({
  items,
  value,
  selectedItem,
  onChange,
  onQueryChange,
  getItemValue,
  getItemLabel,
  renderItem,
  isLoading = false,
  placeholder = 'Select a value',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No results found',
  className,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const handleQueryChange = React.useCallback(
    (newQuery: string) => {
      setQuery(newQuery)
      onQueryChange(newQuery)
    },
    [onQueryChange],
  )

  const handleSelect = React.useCallback(
    (itemValue: string) => {
      const newValue = itemValue === value ? null : itemValue
      onChange(newValue)
      setOpen(false)
    },
    [onChange, value],
  )

  const selectedLabel = React.useMemo(() => {
    if (!value || !selectedItem) return null
    return getItemLabel(selectedItem)
  }, [value, selectedItem, getItemLabel])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'dark:bg-polar-800 dark:hover:bg-polar-700 dark:hover:border-polar-700 dark:border-polar-700 flex w-full flex-row justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 font-normal shadow-xs transition-colors hover:border-gray-300 hover:bg-white',
            selectedItem
              ? 'text-foreground hover:text-foreground'
              : 'text-foreground/50 hover:text-foreground/50',
            className,
          )}
        >
          {selectedLabel ?? placeholder}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9 border-0 focus:ring-0 focus:outline-0"
            value={query}
            onValueChange={handleQueryChange}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin opacity-50" />
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            ) : (
              <CommandGroup>
                {items.map((item) => {
                  const itemValue = getItemValue(item)
                  const itemLabel = getItemLabel(item)
                  const isSelected = value === itemValue

                  return (
                    <CommandItem
                      key={itemValue}
                      value={itemValue}
                      onSelect={handleSelect}
                    >
                      {renderItem ? renderItem(item) : itemLabel}
                      <Check
                        className={cn(
                          'ml-auto',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
