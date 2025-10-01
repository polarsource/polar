import { FormField } from '@polar-sh/ui/components/ui/form'

import AddOutlined from '@mui/icons-material/AddOutlined'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { CustomerCreateForm } from './CreateCustomerModal'
import { CustomerUpdateForm } from './EditCustomerModal'

export const CustomerMetadataForm = () => {
  const { control } = useFormContext<CustomerCreateForm | CustomerUpdateForm>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metadata',
    rules: {
      maxLength: 50,
    },
  })

  return (
    <FormItem>
      <div className="flex flex-row items-center justify-between gap-2 py-2">
        <FormLabel>Metadata</FormLabel>
        <Button
          className="h-8 w-8 rounded-full"
          size="icon"
          type="button"
          onClick={() => {
            append({ key: '', value: '' })
          }}
        >
          <AddOutlined />
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-row items-center gap-2">
            <FormField
              control={control}
              name={`metadata.${index}.key`}
              render={({ field }) => (
                <>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="Key"
                    />
                  </FormControl>
                  <FormMessage />
                </>
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
            <Button
              className={
                'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
              size="icon"
              variant="secondary"
              type="button"
              onClick={() => remove(index)}
            >
              <ClearOutlined fontSize="inherit" />
            </Button>
          </div>
        ))}
      </div>
    </FormItem>
  )
}
