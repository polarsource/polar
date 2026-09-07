import ClearOutlined from '@mui/icons-material/ClearOutlined'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import {
  MetadataFormValues,
  MetadataValue,
  MetadataValueType,
  convertMetadataValue,
  getMetadataValueType,
  metadataValueTypeLabels,
  validateMetadataKey,
  validateMetadataValue,
} from './utils'

const MetadataValueInput = ({
  value,
  onChange,
  ...controlProps
}: Pick<
  React.ComponentProps<'input'>,
  'id' | 'aria-describedby' | 'aria-invalid'
> & {
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
          <SelectTrigger
            {...controlProps}
            className="w-full min-w-0 flex-1 font-mono"
          >
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
    case 'number':
      return (
        <Input
          {...controlProps}
          type="number"
          step="any"
          value={Number.isNaN(value) ? '' : value}
          placeholder="value"
          className="w-full min-w-0 flex-1 font-mono"
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
      )
    default:
      return (
        <Input
          {...controlProps}
          value={value}
          placeholder="value"
          className="w-full min-w-0 flex-1 font-mono"
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
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

export const MetadataForm = ({ label }: { label?: string }) => {
  const { control, trigger, getValues } = useFormContext<MetadataFormValues>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metadata',
    rules: {
      maxLength: 50,
    },
  })

  const validateUniqueKey = useCallback(
    (value: string, index: number) => {
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
    <Box flexDirection="column" gap="s">
      {label ? <Text variant="label">{label}</Text> : null}
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
                  validate: {
                    key: validateMetadataKey,
                    unique: (value: string) => validateUniqueKey(value, index),
                  },
                }}
                render={({ field }) => (
                  <FormItem className="w-full shrink-0 sm:w-48">
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
                  </FormItem>
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
                  rules={{ validate: validateMetadataValue }}
                  render={({ field }) => (
                    <FormItem className="min-w-0 flex-1">
                      <Box display={{ base: 'flex', sm: 'none' }}>
                        <Text variant="caption" color="muted">
                          Value
                        </Text>
                      </Box>
                      <Box alignItems="center" gap="s">
                        <Select
                          value={getMetadataValueType(field.value)}
                          onValueChange={(type) =>
                            field.onChange(
                              convertMetadataValue(
                                field.value,
                                type as MetadataValueType,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="w-32 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(metadataValueTypeLabels).map(
                              ([type, typeLabel]) => (
                                <SelectItem key={type} value={type}>
                                  {typeLabel}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <FormControl>
                          <MetadataValueInput
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                      </Box>
                      <FormMessage />
                    </FormItem>
                  )}
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
    </Box>
  )
}
