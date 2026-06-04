import { FormField } from '@polar-sh/ui/components/ui/form'

import ClearOutlined from '@mui/icons-material/ClearOutlined'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
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
        <SelectTrigger className="flex-1 font-mono">
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
        className="font-mono"
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
      className="font-mono"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

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
        <div className="flex flex-col gap-2">
          <div className="dark:text-polar-500 flex flex-row items-center gap-2 text-sm text-gray-500">
            <div className="w-48">Key</div>
            <div className="flex flex-1 flex-row gap-2">
              <div className="w-32 shrink-0">Type</div>
              <div className="flex-1">Value</div>
            </div>
            <div className="w-8 shrink-0" />
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-row items-start gap-2">
              <FormField
                control={control}
                name={`metadata.${index}.key`}
                rules={{
                  validate: (value: string) => validateUniqueKey(value, index),
                }}
                render={({ field }) => (
                  <div className="flex w-48 flex-col gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        className="font-mono"
                        value={field.value || ''}
                        placeholder="key"
                        onChange={(e) => {
                          field.onChange(e)
                          revalidateAllKeys()
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                )}
              />
              <FormField
                control={control}
                name={`metadata.${index}.value`}
                render={({ field }) => {
                  const type = getValueType(field.value)
                  return (
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-row items-center gap-2">
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
                      </div>
                      <FormMessage />
                    </div>
                  )
                }}
              />
              <div className="flex h-10">
                <Button
                  className={
                    'self-center border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                  }
                  size="icon"
                  variant="secondary"
                  type="button"
                  onClick={() => remove(index)}
                >
                  <ClearOutlined fontSize="inherit" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && (
        <p className="dark:text-polar-500 dark:border-polar-700 flex items-center justify-center rounded-2xl border border-gray-300 p-8 text-center text-sm text-gray-500">
          No metadata added
        </p>
      )}

      <div className="flex flex-row items-center justify-end">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            type="button"
            onClick={() => {
              append({ key: '', value: '' })
            }}
          >
            Add Metadata
          </Button>
        </p>
      </div>
    </FormItem>
  )
}
