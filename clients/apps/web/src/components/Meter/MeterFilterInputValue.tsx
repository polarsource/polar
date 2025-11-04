'use client'

import { useEventNames } from '@/hooks/queries/events'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import DatePicker from '@polar-sh/ui/components/atoms/DateTimePicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { useEffect, useMemo, useState } from 'react'
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

    if (query && !matches.find((item) => item.name === query)) {
      // No custom option needed
      matches.push({ name: query, custom: true })
    }

    return matches
  }, [eventNames, query])

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
      placeholder="Select event name"
    ></Combobox>
  )
}

const TimestampInput = ({ field }: ValueInputProps) => {
  // Parse Unix epoch to date and time
  const parseEpoch = (
    epoch: number | undefined,
  ): { date: string; time: string } => {
    if (!epoch) {
      return { date: '', time: '00:00' }
    }
    const dt = new Date(epoch * 1000) // Convert seconds to milliseconds
    const date = dt.toISOString().split('T')[0]
    const hours = String(dt.getUTCHours()).padStart(2, '0')
    const minutes = String(dt.getUTCMinutes()).padStart(2, '0')
    return { date, time: `${hours}:${minutes}` }
  }

  // Convert date and time to Unix epoch
  const toEpoch = (dateStr: string, timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const dt = new Date(dateStr)
    dt.setUTCHours(hours, minutes, 0, 0)
    return Math.floor(dt.getTime() / 1000) // Convert milliseconds to seconds
  }

  const { date, time } = parseEpoch(field.value)
  const [localDate, setLocalDate] = useState(date)
  const [localTime, setLocalTime] = useState(time)

  // Sync with field value changes
  useEffect(() => {
    const { date, time } = parseEpoch(field.value)
    setLocalDate(date)
    setLocalTime(time)
  }, [field.value])

  const updateValue = (newDate: string, newTime: string) => {
    if (!newDate || !newTime) return
    const epoch = toEpoch(newDate, newTime)
    field.onChange(epoch)
  }

  return (
    <div className="flex gap-2">
      <DatePicker
        value={localDate}
        onChange={(isoDate) => {
          if (!isoDate) return
          const dateOnly = isoDate.split('T')[0]
          setLocalDate(dateOnly)
          updateValue(dateOnly, localTime)
        }}
      />
      <Input
        type="time"
        value={localTime}
        onChange={(e) => {
          const newTime = e.target.value
          setLocalTime(newTime)
          updateValue(localDate, newTime)
        }}
        className="w-32"
      />
    </div>
  )
}

const SourceInput = ({ field }: ValueInputProps) => {
  return (
    <Select value={field.value || undefined} onValueChange={field.onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select source" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">System</SelectItem>
        <SelectItem value="user">User</SelectItem>
      </SelectContent>
    </Select>
  )
}

const MetadataInput = ({ field }: ValueInputProps) => {
  return (
    <Input
      {...field}
      value={field.value || ''}
      autoComplete="off"
      className="font-mono md:text-xs"
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
    case 'source':
      return <SourceInput field={field} />
    default:
      return <MetadataInput field={field} />
  }
}

export default MeterFilterInputValue
