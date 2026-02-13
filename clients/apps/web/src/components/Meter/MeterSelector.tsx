'use client'

import { useMeter, useMeters } from '@/hooks/queries/meters'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import { useState } from 'react'

export default function MeterSelector({
  organizationId,
  value,
  onChange,
  className,
  placeholder = 'Select a meter',
}: {
  organizationId: string
  value: string | null
  onChange: (meterId: string | null) => void
  className?: string
  disabled?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')

  const { data: meters, isLoading } = useMeters(organizationId, {
    query: query || undefined,
    sorting: ['name'],
    is_archived: false,
    limit: 30,
  })

  const { data: selectedMeter } = useMeter(value ?? '', {
    enabled: !!value,
  })

  return (
    <Combobox
      items={meters?.items ?? []}
      value={value}
      selectedItem={
        selectedMeter ?? meters?.items?.find((m) => m.id === value) ?? null
      }
      onChange={onChange}
      onQueryChange={setQuery}
      getItemValue={(meter) => meter.id}
      getItemLabel={(meter) => meter.name}
      isLoading={isLoading}
      placeholder={placeholder}
      searchPlaceholder="Search meters..."
      emptyLabel="No meters found"
      className={className}
    />
  )
}
