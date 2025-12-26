'use client'

import { useEventNames } from '@/hooks/queries/events'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useMemo, useState } from 'react'
import { ControllerRenderProps } from 'react-hook-form'

interface ValueInputProps {
  field: ControllerRenderProps<any, any>
}

interface EventNameInputProps extends ValueInputProps {
  organizationId: string
}

const EventNameInput = ({ field, organizationId }: EventNameInputProps) => {
  const [query, setQuery] = useState('')

  const { data: eventNames } = useEventNames(organizationId, {
    limit: 100,
    sorting: ['-occurrences'],
    source: 'user',
    query: query || undefined,
  })

  const items = useMemo(() => {
    const matches = (eventNames?.pages.flatMap((page) => page.items) ?? []).map(
      (item) => ({
        name: item.name,
        custom: false,
      }),
    )

    if (field.value && !matches.find((item) => item.name === field.value)) {
      matches.push({ name: field.value, custom: true })
    }

    if (query && !matches.find((item) => item.name === query)) {
      matches.push({ name: query, custom: true })
    }

    return matches
  }, [eventNames, query, field.value])

  const selectedItem = items.find((item) => item.name === field.value) || null

  return (
    <Combobox
      items={items}
      value={field.value || null}
      selectedItem={selectedItem}
      onChange={(value) => {
        if (value === null) {
          field.onChange('')
        } else {
          field.onChange(value)
        }
      }}
      onQueryChange={setQuery}
      getItemValue={(item) => item.name}
      getItemLabel={(item) => item.name}
      renderItem={(item) => (
        <div className="font-mono text-xs">{item.name}</div>
      )}
      className="font-mono text-xs"
      placeholder="Select event name"
    ></Combobox>
  )
}

const TimestampInput = ({ field }: ValueInputProps) => {
  return (
    <Input
      {...field}
      value={field.value || ''}
      placeholder="unix timestamp"
      autoComplete="off"
      className="font-mono text-xs"
      onChange={(e) => {
        const val = e.target.value
        const intVal = parseInt(val, 10)
        if (!isNaN(intVal)) {
          field.onChange(intVal)
        } else {
          field.onChange(val)
        }
      }}
    />
  )
}

const MetadataInput = ({ field }: ValueInputProps) => {
  return (
    <Input
      {...field}
      value={field.value || ''}
      autoComplete="off"
      className="font-mono md:text-xs"
      placeholder="property value"
      onChange={(e) => {
        const val = e.target.value
        // Try parsing as float
        const floatVal = parseFloat(val)
        if (!isNaN(floatVal)) {
          field.onChange(floatVal)
          return
        }
        // Try parsing as boolean
        if (val.toLowerCase() === 'true') {
          field.onChange(true)
          return
        }
        if (val.toLowerCase() === 'false') {
          field.onChange(false)
          return
        }
        // Fallback to string
        field.onChange(val)
      }}
    />
  )
}

interface MeterFilterInputValueProps {
  field: ControllerRenderProps<any, any>
  property: string
  organizationId: string
}

const MeterFilterInputValue = ({
  field,
  property,
  organizationId,
}: MeterFilterInputValueProps) => {
  switch (property) {
    case 'name':
      return <EventNameInput field={field} organizationId={organizationId} />
    case 'timestamp':
      return <TimestampInput field={field} />
    default:
      return <MetadataInput field={field} />
  }
}

export default MeterFilterInputValue
