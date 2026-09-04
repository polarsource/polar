import { schemas } from '@polar-sh/client'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { XIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

type MetadataValue = string | number | boolean
type MetadataValueType = 'string' | 'number' | 'boolean'
type MetadataEntry = [string, MetadataValue]

const metadataValueTypeLabels: Record<MetadataValueType, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
}

const getMetadataValueType = (value: MetadataValue): MetadataValueType =>
  typeof value as MetadataValueType

const convertMetadataValue = (
  value: MetadataValue,
  type: MetadataValueType,
): MetadataValue => {
  switch (type) {
    case 'string':
      return String(value)
    case 'number':
      return typeof value === 'boolean'
        ? Number(value)
        : Number.parseFloat(String(value))
    case 'boolean':
      return typeof value === 'string' ? value === 'true' : Boolean(value)
  }
}

const validateMetadata = (
  metadata: Record<string, MetadataValue> | undefined,
) =>
  Object.values(metadata ?? {}).every(
    (value) => typeof value !== 'number' || Number.isFinite(value),
  ) || 'Number values must be valid numbers'

const MetadataValueInput = ({
  value,
  onChange,
}: {
  value: MetadataValue
  onChange: (value: MetadataValue) => void
}) => {
  switch (typeof value) {
    case 'boolean':
      return (
        <Select
          value={String(value)}
          onValueChange={(newValue) => onChange(newValue === 'true')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      )
    case 'number':
      return (
        <Input
          type="number"
          step="any"
          placeholder="Value (e.g. 42)"
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
      )
    default:
      return (
        <Input
          placeholder="Value (e.g. premium)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

export const BenefitMetadataForm = () => {
  const { control } = useFormContext<schemas['BenefitCreate']>()

  return (
    <FormField
      control={control}
      name="metadata"
      defaultValue={{}}
      rules={{ validate: validateMetadata }}
      render={({ field }) => {
        const entries: MetadataEntry[] = Object.entries(field.value || {})
        const setEntry = (index: number, entry: MetadataEntry) => {
          const newEntries = [...entries]
          newEntries[index] = entry
          field.onChange(Object.fromEntries(newEntries))
        }
        return (
          <FormItem>
            <Box alignItems="center" justifyContent="between">
              <FormLabel>Metadata</FormLabel>
            </Box>
            <Box flexDirection="column" rowGap="s">
              {entries.map(([key, value], index) => (
                <Box key={index} alignItems="center" columnGap="s">
                  <Input
                    placeholder="Key (e.g. role)"
                    value={key}
                    onChange={(e) => setEntry(index, [e.target.value, value])}
                  />
                  <Select
                    value={getMetadataValueType(value)}
                    onValueChange={(type) =>
                      setEntry(index, [
                        key,
                        convertMetadataValue(value, type as MetadataValueType),
                      ])
                    }
                  >
                    <SelectTrigger className="w-32 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(metadataValueTypeLabels).map(
                        ([type, label]) => (
                          <SelectItem key={type} value={type}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <MetadataValueInput
                    value={value}
                    onChange={(newValue) => setEntry(index, [key, newValue])}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const newEntries = entries.filter((_, i) => i !== index)
                      field.onChange(Object.fromEntries(newEntries))
                    }}
                  >
                    <XIcon className="-mx-1 h-4 w-4" />
                  </Button>
                </Box>
              ))}
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  field.onChange({
                    ...(field.value || {}),
                    '': '',
                  })
                }}
              >
                Add Metadata
              </Button>
            </Box>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
