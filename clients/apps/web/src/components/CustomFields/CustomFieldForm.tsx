import { ClearOutlined } from '@mui/icons-material'
import {
  CustomFieldCreate,
  CustomFieldType,
  CustomFieldUpdate,
} from '@polar-sh/sdk'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'polarkit/components/ui/accordion'
import { Switch } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import React from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import CustomFieldTypeLabel from './CustomFieldTypeLabel'

const CustomFieldTextProperties = () => {
  const { control } = useFormContext<
    (CustomFieldCreate | CustomFieldUpdate) & { type: 'text' }
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
  const { control } = useFormContext<
    (CustomFieldCreate | CustomFieldUpdate) & { type: 'number' | 'datetime' }
  >()
  return (
    <>
      <FormField
        control={control}
        name="properties.ge"
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Greater than or equal</FormLabel>
              <FormControl>
                <Input {...field} type="number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name="properties.le"
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Less than or equal</FormLabel>
              <FormControl>
                <Input {...field} type="number" />
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
    (CustomFieldCreate | CustomFieldUpdate) & { type: 'select' }
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
    CustomFieldCreate | CustomFieldUpdate
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
                  {Object.values(CustomFieldType).map((type) => (
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
                across your organization.
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
      {type === CustomFieldType.SELECT && <CustomFieldSelectProperties />}
      <Accordion type="single" collapsible className="flex flex-col gap-y-6">
        <AccordionItem
          value="form-input-options"
          className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
        >
          <AccordionTrigger className="hover:no-underline">
            Form input options
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-y-6">
            {type === CustomFieldType.TEXT && (
              <FormField
                control={control}
                name="properties.textarea"
                render={({ field }) => {
                  return (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
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
        {(type === CustomFieldType.TEXT ||
          type === CustomFieldType.NUMBER ||
          type === CustomFieldType.DATE) && (
          <AccordionItem
            value="validation-constraints"
            className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              Validation constraints
            </AccordionTrigger>

            <AccordionContent className="flex flex-col gap-y-6">
              {type === CustomFieldType.TEXT && <CustomFieldTextProperties />}
              {type === CustomFieldType.NUMBER && (
                <CustomFieldComparableProperties />
              )}
              {type === CustomFieldType.DATE && (
                <CustomFieldComparableProperties />
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </>
  )
}

export default CustomFieldForm
