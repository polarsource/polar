'use client'

import CustomFieldTypeIcon from '@/components/CustomFields/CustomFieldTypeIcon'
import { Section } from '@/components/Layout/Section'
import { useCustomFields } from '@/hooks/queries'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
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
  FormField,
  FormLabel,
} from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { ProductFormType } from './ProductForm'

export interface ProductCustomFieldSectionProps {
  className?: string
  organization: schemas['Organization']
  compact?: boolean
}

export const ProductCustomFieldSection = ({
  className,
  organization,
  compact,
}: ProductCustomFieldSectionProps) => {
  const { control } = useFormContext<ProductFormType>()
  const { data: customFields } = useCustomFields(organization.id)

  const {
    fields: attachedCustomFields,
    remove,
    append,
  } = useFieldArray({
    control,
    name: 'attached_custom_fields',
  })

  const attachedCustomFieldsMap = useMemo(
    () =>
      attachedCustomFields.reduce<Record<string, schemas['CustomField']>>(
        (acc, field) => {
          const customField = customFields?.items.find(
            ({ id }) => id === field.custom_field_id,
          )
          if (customField) {
            return {
              ...acc,
              [field.custom_field_id]: customField,
            }
          }
          return acc
        },
        {},
      ),
    [attachedCustomFields, customFields],
  )

  const [selectedField, setSelectedField] = useState<
    schemas['CustomField'] | null
  >(null)
  const onSelectField = (id: string) => {
    const customField = customFields?.items.find((field) => field.id === id)
    if (customField) {
      setSelectedField(customField)
    }
  }
  const onAddField = () => {
    if (!selectedField) {
      return
    }
    append({ custom_field_id: selectedField.id, required: false })
    setSelectedField(null)
  }

  return (
    <Section
      title="Checkout Fields"
      description="Ask for additional information from the customer during checkout"
      className={className}
      compact={compact}
      cta={
        <Link
          className="text-sm text-blue-500"
          href={`/dashboard/${organization.slug}/settings/custom-fields`}
          target="_blank"
        >
          Manage Custom Fields
        </Link>
      }
    >
      <div className="flex w-full flex-col gap-4">
        {attachedCustomFields.length > 0 && (
          <List size="small" className="w-full">
            {Object.entries(attachedCustomFieldsMap).map(
              ([customFieldId, customField], index) => (
                <ListItem key={customFieldId} size="small">
                  <div className="flex w-full justify-between">
                    <div className="flex flex-row items-center gap-2">
                      <CustomFieldTypeIcon type={customField.type} />
                      {customField.name}
                    </div>
                    <div className="flex flex-row items-center gap-4">
                      <FormField
                        control={control}
                        name={`attached_custom_fields.${index}.required`}
                        render={({ field }) => {
                          return (
                            <div className="flex flex-row items-center gap-4">
                              <FormLabel
                                className={twMerge(
                                  'text-sm',
                                  field.value
                                    ? ''
                                    : 'dark:text-polar-500 text-gray-500',
                                )}
                              >
                                Required
                              </FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </div>
                          )
                        }}
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
                  </div>
                </ListItem>
              ),
            )}
          </List>
        )}
        {(customFields?.items.filter(({ id }) => !attachedCustomFieldsMap[id])
          .length ?? 0) > 0 && (
          <div className="flex flex-row gap-2">
            <Select
              value={selectedField ? selectedField.id : ''}
              onValueChange={onSelectField}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {customFields?.items
                  .filter(({ id }) => !attachedCustomFieldsMap[id])
                  .map((customField) => (
                    <SelectItem
                      key={customField.id}
                      value={customField.id}
                      textValue={customField.name}
                    >
                      <div className="flex flex-row items-center gap-2">
                        <CustomFieldTypeIcon type={customField.type} />
                        {customField.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="secondary" onClick={onAddField}>
              Add Field
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}
