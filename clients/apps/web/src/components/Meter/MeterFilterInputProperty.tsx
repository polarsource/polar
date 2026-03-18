'use client'

import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { ControllerRenderProps } from 'react-hook-form'

const STANDARD_FIELDS = ['name', 'timestamp'] as const
type StandardField = (typeof STANDARD_FIELDS)[number]
type PropertyType = StandardField | 'metadata'

const PROPERTY_DISPLAY_NAMES: Record<PropertyType, string> = {
  name: 'Name',
  timestamp: 'Timestamp',
  metadata: 'Metadata',
}

interface MeterFilterInputPropertyProps {
  field: ControllerRenderProps<any, any>
}

const MeterFilterInputProperty = ({ field }: MeterFilterInputPropertyProps) => {
  // Parse the field value to determine the property type and metadata path
  const parseValue = (
    value: string,
  ): { type: PropertyType; metadataPath: string } => {
    if (!value) {
      return { type: 'metadata', metadataPath: '' }
    }

    // Check if it's a standard field
    if (STANDARD_FIELDS.includes(value as StandardField)) {
      return { type: value as StandardField, metadataPath: '' }
    }

    // Otherwise it's metadata - strip the prefix if present
    const metadataPath = value.startsWith('metadata.')
      ? value.slice('metadata.'.length)
      : value

    return { type: 'metadata', metadataPath }
  }

  const { type: propertyType, metadataPath } = parseValue(field.value)

  const handleTypeChange = (newType: PropertyType) => {
    if (newType === 'metadata') {
      field.onChange(metadataPath ? `metadata.${metadataPath}` : '')
    } else {
      field.onChange(newType)
    }
  }

  const handleMetadataPathChange = (path: string) => {
    field.onChange(path ? `metadata.${path}` : '')
  }

  if (propertyType === 'metadata') {
    return (
      <div className="flex flex-col gap-2">
        <Select value={propertyType} onValueChange={handleTypeChange}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROPERTY_DISPLAY_NAMES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={metadataPath}
          onChange={(e) => handleMetadataPathChange(e.target.value)}
          placeholder="metadata key"
          autoComplete="off"
          className="flex-1 font-mono md:text-xs"
        />
      </div>
    )
  }

  return (
    <Select value={propertyType} onValueChange={handleTypeChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PROPERTY_DISPLAY_NAMES).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default MeterFilterInputProperty
