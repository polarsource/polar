'use client'

import { schemas } from '@polar-sh/client'
import { Grid, Input } from '@polar-sh/orbit'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'

type UnitLabel = NonNullable<
  schemas['ProductPriceUnitBasedCreate']['unit_label']
>

const UNIT_LABEL_MAX_LENGTH = 32

const composeUnitLabel = (
  existing: UnitLabel | null | undefined,
  singular: string,
  plural: string,
): UnitLabel | null => {
  const singularForm = singular.trim()
  const pluralForm = plural.trim() || (singularForm ? `${singularForm}s` : '')
  const composed: UnitLabel = { ...existing }
  delete composed['en']
  if (pluralForm) {
    composed['en'] = {
      ...(singularForm ? { '=1': singularForm } : {}),
      other: pluralForm,
    }
  }
  return Object.keys(composed).length > 0 ? composed : null
}

interface UnitLabelFieldsProps {
  index: number
}

export const UnitLabelFields = ({ index }: UnitLabelFieldsProps) => {
  const { control, setValue, getValues } = useFormContext<ProductFormType>()

  const initialValue = getValues(`prices.${index}.unit_label`) as
    | UnitLabel
    | null
    | undefined
  const initialForms =
    initialValue?.['en'] ?? Object.values(initialValue ?? {})[0] ?? {}
  const [singular, setSingular] = useState(initialForms['=1'] ?? '')
  const [plural, setPlural] = useState(initialForms['other'] ?? '')

  return (
    <FormField
      control={control}
      name={`prices.${index}.unit_label`}
      rules={{
        validate: (value) =>
          Object.values((value as UnitLabel | null) ?? {}).every((forms) =>
            Object.values(forms).every(
              (form) => form.length <= UNIT_LABEL_MAX_LENGTH,
            ),
          ) || 'Must be 32 characters or fewer',
      }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Unit name</FormLabel>
          <FormDescription>
            What customers see instead of &ldquo;unit&rdquo; at checkout and on
            invoices. Leave blank to use the default.
          </FormDescription>
          <Grid templateColumns="repeat(2, 1fr)" columnGap="m">
            <FormItem>
              <FormLabel>Singular</FormLabel>
              <FormControl>
                <Input
                  value={singular}
                  placeholder="device"
                  autoComplete="off"
                  onChange={(e) => {
                    setSingular(e.target.value)
                    field.onChange(
                      composeUnitLabel(
                        field.value as UnitLabel | null,
                        e.target.value,
                        plural,
                      ),
                    )
                    setValue(`prices.${index}.id`, '')
                  }}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Plural</FormLabel>
              <FormControl>
                <Input
                  value={plural}
                  placeholder="devices"
                  autoComplete="off"
                  onChange={(e) => {
                    setPlural(e.target.value)
                    field.onChange(
                      composeUnitLabel(
                        field.value as UnitLabel | null,
                        singular,
                        e.target.value,
                      ),
                    )
                    setValue(`prices.${index}.id`, '')
                  }}
                />
              </FormControl>
            </FormItem>
          </Grid>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
