import { FormField } from '@polar-sh/ui/components/ui/form'

import ClearOutlined from '@mui/icons-material/ClearOutlined'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Input } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import {
  FormControl,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { ProductFormType } from './ProductForm/ProductForm'

type MetadataValue = NonNullable<schemas['ProductCreate']['metadata']>[string]
type MetadataValueType = 'string' | 'number' | 'boolean'

const getValueType = (value: MetadataValue): MetadataValueType => {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

const defaultValueForType = (type: MetadataValueType): MetadataValue => {
  switch (type) {
    case 'number':
      return 0
    case 'boolean':
      return false
    default:
      return ''
  }
}

const MetadataValueInput = ({
  type,
  value,
  onChange,
}: {
  type: MetadataValueType
  value: MetadataValue
  onChange: (value: MetadataValue) => void
}) => {
  if (type === 'boolean') {
    return (
      <Select
        value={value === true ? 'true' : 'false'}
        onValueChange={(v) => onChange(v === 'true')}
      >
        <SelectTrigger className="w-full min-w-0 flex-1 font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem className="font-mono" value="true">
            true
          </SelectItem>
          <SelectItem className="font-mono" value="false">
            false
          </SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (type === 'number') {
    return (
      <Input
        type="number"
        value={value.toString()}
        placeholder="value"
        className="w-full min-w-0 flex-1 font-mono"
        onChange={(e) => {
          const parsed = e.target.valueAsNumber
          onChange(Number.isNaN(parsed) ? 0 : parsed)
        }}
      />
    )
  }

  return (
    <Input
      value={value.toString()}
      placeholder="value"
      className="w-full min-w-0 flex-1 font-mono"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const RemoveMetadataButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    className={
      'self-center border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
    }
    size="icon"
    variant="secondary"
    type="button"
    aria-label="Remove metadata"
    onClick={onClick}
  >
    <ClearOutlined fontSize="inherit" />
  </Button>
)

export const ProductMetadataForm = () => {
  const { control, trigger, getValues } = useFormContext<ProductFormType>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metadata',
    rules: {
      maxLength: 50,
    },
  })

  const validateUniqueKey = useCallback(
    (value: string, index: number) => {
      if (!value) return true
      const metadata = getValues('metadata')
      const duplicateIndex = metadata?.findIndex(
        (item, i) => i !== index && item.key === value,
      )
      if (duplicateIndex !== undefined && duplicateIndex !== -1) {
        return 'Duplicate key'
      }
      return true
    },
    [getValues],
  )

  const revalidateAllKeys = useCallback(() => {
    fields.forEach((_, i) => trigger(`metadata.${i}.key`))
  }, [fields, trigger])

  return (
    <FormItem className="flex flex-col gap-2">
      {fields.length > 0 && (
        <Box flexDirection="column" gap="s">
          <Box
            display={{ base: 'none', sm: 'flex' }}
            alignItems="center"
            gap="s"
          >
            <Box width={192} flexShrink={0}>
              <Text variant="caption" color="muted">
                Key
              </Text>
            </Box>
            <Box flex={1} gap="s">
              <Box width={128} flexShrink={0}>
                <Text variant="caption" color="muted">
                  Type
                </Text>
              </Box>
              <Box flex={1}>
                <Text variant="caption" color="muted">
                  Value
                </Text>
              </Box>
            </Box>
            <Box width={32} flexShrink={0} />
          </Box>
          {fields.map((field, index) => (
            <Box
              key={field.id}
              flexDirection={{ base: 'column', sm: 'row' }}
              alignItems="start"
              gap="s"
              borderTopWidth={index > 0 ? { base: 1, sm: 0 } : undefined}
              borderStyle="solid"
              borderColor="border-primary"
              paddingTop={index > 0 ? { base: 'l', sm: 'none' } : undefined}
            >
              <FormField
                control={control}
                name={`metadata.${index}.key`}
                rules={{
                  validate: (value: string) => validateUniqueKey(value, index),
                }}
                render={({ field }) => (
                  <Box
                    flexDirection="column"
                    gap="s"
                    width={{ base: '100%', sm: 192 }}
                    flexShrink={0}
                  >
                    <Box display={{ base: 'flex', sm: 'none' }}>
                      <Text variant="caption" color="muted">
                        Key
                      </Text>
                    </Box>
                    <Box alignItems="center" gap="s">
                      <FormControl>
                        <Input
                          {...field}
                          className="w-full min-w-0 flex-1 font-mono"
                          value={field.value || ''}
                          placeholder="key"
                          onChange={(e) => {
                            field.onChange(e)
                            revalidateAllKeys()
                          }}
                        />
                      </FormControl>
                      <Box
                        display={{ base: 'flex', sm: 'none' }}
                        flexShrink={0}
                      >
                        <RemoveMetadataButton onClick={() => remove(index)} />
                      </Box>
                    </Box>
                    <FormMessage />
                  </Box>
                )}
              />
              <Box
                width={{ base: '100%', sm: 'auto' }}
                flex={1}
                minWidth={0}
                gap="s"
              >
                <FormField
                  control={control}
                  name={`metadata.${index}.value`}
                  render={({ field }) => {
                    const type = getValueType(field.value)
                    return (
                      <Box flexDirection="column" gap="s" flex={1} minWidth={0}>
                        <Box display={{ base: 'flex', sm: 'none' }}>
                          <Text variant="caption" color="muted">
                            Value
                          </Text>
                        </Box>
                        <Box alignItems="center" gap="s">
                          <Select
                            value={type}
                            onValueChange={(nextType) =>
                              field.onChange(
                                defaultValueForType(
                                  nextType as MetadataValueType,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="w-32 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                            </SelectContent>
                          </Select>
                          <MetadataValueInput
                            type={type}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </Box>
                        <FormMessage />
                      </Box>
                    )
                  }}
                />
                <Box
                  display={{ base: 'none', sm: 'flex' }}
                  height={40}
                  flexShrink={0}
                >
                  <RemoveMetadataButton onClick={() => remove(index)} />
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {fields.length === 0 && (
        <Box
          alignItems="center"
          justifyContent="center"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          padding="2xl"
          textAlign="center"
        >
          <Text variant="caption" color="muted">
            No metadata added
          </Text>
        </Box>
      )}

      <Box alignItems="center" justifyContent="end">
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={() => {
            append({ key: '', value: '' })
          }}
        >
          Add Metadata
        </Button>
      </Box>
    </FormItem>
  )
}
