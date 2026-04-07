import ClearOutlined from '@mui/icons-material/ClearOutlined'
import { enums, schemas } from '@polar-sh/client'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@polar-sh/ui/components/atoms/Accordion'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import CustomFieldTypeLabel from './CustomFieldTypeLabel'

const CustomFieldTextProperties = () => {
  const { control } = useFormContext<
    (schemas['CustomFieldCreate'] | schemas['CustomFieldUpdate']) & {
      type: 'text'
    }
  >()
  return (
    <>
      <FormField
        control={control}
        name="properties.min_length"
        rules={{
          min: {
            value: 0,
            message: 'This field must be a positive number',
          },
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Min length</FormLabel>
              <FormControl>
                <Input {...field} type="number" min="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name="properties.max_length"
        rules={{
          min: {
            value: 0,
            message: 'This field must be a positive number',
          },
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Max length</FormLabel>
              <FormControl>
                <Input {...field} type="number" min="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}

const CustomFieldComparableProperties = () => {
  const { control, watch } = useFormContext<
    (schemas['CustomFieldCreate'] | schemas['CustomFieldUpdate']) & {
      type: 'number' | 'datetime'
    }
  >()
  const geValue = watch('properties.ge')
  const leValue = watch('properties.le')

  return (
    <>
      <FormField
        control={control}
        name="properties.ge"
        rules={{
          validate: {
            integer: (value) => {
              if (!value && value !== 0) {
                return true
              }
              const num = Number(value)
              if (isNaN(num) || !Number.isInteger(num)) {
                return 'Value must be a valid integer'
              }
              const INT32_MIN = -(2 ** 31)
              const INT32_MAX = 2 ** 31 - 1
              if (num < INT32_MIN || num > INT32_MAX) {
                return 'Value is out of range'
              }
              return true
            },
            leThanLe: (value) => {
              if ((value || value === 0) && (leValue || leValue === 0)) {
                const ge = Number(value)
                const le = Number(leValue)
                if (!isNaN(ge) && !isNaN(le) && ge > le) {
                  return 'Must be less than or equal to "Less than or equal" value'
                }
              }
              return true
            },
          },
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Greater than or equal</FormLabel>
              <FormControl>
                <Input {...field} type="number" step="1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name="properties.le"
        rules={{
          validate: {
            integer: (value) => {
              if (!value && value !== 0) {
                return true
              }
              const num = Number(value)
              if (isNaN(num) || !Number.isInteger(num)) {
                return 'Value must be a valid integer'
              }
              const INT32_MIN = -(2 ** 31)
              const INT32_MAX = 2 ** 31 - 1
              if (num < INT32_MIN || num > INT32_MAX) {
                return 'Value is out of range'
              }
              return true
            },
            geThanGe: (value) => {
              if ((value || value === 0) && (geValue || geValue === 0)) {
                const le = Number(value)
                const ge = Number(geValue)
                if (!isNaN(le) && !isNaN(ge) && le < ge) {
                  return 'Must be greater than or equal to "Greater than or equal" value'
                }
              }
              return true
            },
          },
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Less than or equal</FormLabel>
              <FormControl>
                <Input {...field} type="number" step="1" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </>
  )
}

const CustomFieldSelectProperties = () => {
  const { control } = useFormContext<
    (schemas['CustomFieldCreate'] | schemas['CustomFieldUpdate']) & {
      type: 'select'
    }
  >()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'properties.options',
    rules: {
      minLength: 1,
    },
  })
  return (
    <FormItem>
      <FormLabel>Select options</FormLabel>
      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-row items-center gap-2">
            <FormField
              control={control}
              name={`properties.options.${index}.value`}
              render={({ field }) => (
                <div className="flex flex-col">
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="Value"
                    />
                  </FormControl>
                  <FormMessage />
                </div>
              )}
            />
            <FormField
              control={control}
              name={`properties.options.${index}.label`}
              render={({ field }) => (
                <div className="flex flex-col">
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="Label"
                    />
                  </FormControl>
                  <FormMessage />
                </div>
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
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          type="button"
          onClick={() => {
            append({ value: '', label: '' })
          }}
        >
          Add option
        </Button>
      </div>
    </FormItem>
  )
}

interface CustomFieldFormBaseProps {
  update: boolean
}

const CustomFieldForm: React.FC<CustomFieldFormBaseProps> = ({ update }) => {
  const { control, watch } = useFormContext<
    schemas['CustomFieldCreate'] | schemas['CustomFieldUpdate']
  >()
  const type = watch('type')

  return (
    <>
      {!update && (
        <FormField
          control={control}
          name="type"
          rules={{ required: 'This field is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(enums.customFieldTypeValues).map((type) => (
                    <SelectItem key={type} value={type} textValue={type}>
                      <CustomFieldTypeLabel type={type} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name="slug"
        rules={{
          minLength: {
            value: 1,
            message: 'This field must not be empty',
          },
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Will be used as a key when storing the value. Must be unique
                across your organization. It can only contain ASCII letters,
                numbers and hyphens.
              </FormDescription>
            </FormItem>
          )
        }}
      />

      <FormField
        control={control}
        name="name"
        rules={{
          minLength: {
            value: 1,
            message: 'This field must not be empty',
          },
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      {type === 'select' && <CustomFieldSelectProperties />}
      <Accordion type="single" collapsible className="flex flex-col gap-y-6">
        <AccordionItem
          value="form-input-options"
          className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
        >
          <AccordionTrigger className="hover:no-underline">
            Form input options
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-y-6">
            {type === 'text' && (
              <FormField
                control={control}
                name="properties.textarea"
                render={({ field }) => {
                  return (
                    <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Textarea</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}
            <FormField
              control={control}
              name="properties.form_label"
              rules={{
                minLength: {
                  value: 1,
                  message: 'This field must not be empty',
                },
              }}
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Fallback to field name if not provided. Markdown
                      supported.
                    </FormDescription>
                  </FormItem>
                )
              }}
            />
            <FormField
              control={control}
              name="properties.form_help_text"
              rules={{
                minLength: {
                  value: 1,
                  message: 'This field must not be empty',
                },
              }}
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Help text</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Used on the checkout form. Markdown supported.
                    </FormDescription>
                  </FormItem>
                )
              }}
            />
            <FormField
              control={control}
              name="properties.form_placeholder"
              rules={{
                minLength: {
                  value: 1,
                  message: 'This field must not be empty',
                },
              }}
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Placeholder</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Used on the checkout form.
                    </FormDescription>
                  </FormItem>
                )
              }}
            />
          </AccordionContent>
        </AccordionItem>
        {(type === 'text' || type === 'number' || type === 'date') && (
          <AccordionItem
            value="validation-constraints"
            className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              Validation constraints
            </AccordionTrigger>

            <AccordionContent className="flex flex-col gap-y-6">
              {type === 'text' && <CustomFieldTextProperties />}
              {type === 'number' && <CustomFieldComparableProperties />}
              {type === 'date' && <CustomFieldComparableProperties />}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </>
  )
}

export default CustomFieldForm
