import { FormField } from '@spaire/ui/components/ui/form'

import ClearOutlined from '@mui/icons-material/ClearOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import {
  FormControl,
  FormItem,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { ProductFormType } from './ProductForm/ProductForm'

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
    <FormItem className="flex flex-col gap-6">
      {fields.length > 0 && (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-row items-start gap-2">
              <FormField
                control={control}
                name={`metadata.${index}.key`}
                rules={{
                  validate: (value: string) => validateUniqueKey(value, index),
                }}
                render={({ field }) => (
                  <div className="flex flex-col gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Key"
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
                render={({ field }) => (
                  <>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value.toString() || ''}
                        placeholder="Value"
                      />
                    </FormControl>
                    <FormMessage />
                  </>
                )}
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
    </FormItem>
  )
}
