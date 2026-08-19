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
  existing: UnitLabel | null,
  singular: string,
  plural: string,
): UnitLabel | null => {
  const otherLocales: UnitLabel = Object.fromEntries(
    Object.entries(existing ?? {}).filter(([locale]) => locale !== 'en'),
  )
  const one = singular.trim()
  const other = plural.trim() || (one ? `${one}s` : '')

  const composed: UnitLabel = other
    ? { ...otherLocales, en: { ...(one ? { '=1': one } : {}), other } }
    : otherLocales

  return Object.keys(composed).length > 0 ? composed : null
}

const validateUnitLabel = (value: UnitLabel | null) => {
  const withinLimit = Object.values(value ?? {}).every((forms) =>
    Object.values(forms).every((form) => form.length <= UNIT_LABEL_MAX_LENGTH),
  )
  return withinLimit || `Must be ${UNIT_LABEL_MAX_LENGTH} characters or fewer`
}

interface UnitLabelFieldsProps {
  index: number
}

export const UnitLabelFields = ({ index }: UnitLabelFieldsProps) => {
  const { control, setValue, getValues } = useFormContext<ProductFormType>()

  const initialLabel = getValues(`prices.${index}.unit_label`) as
    | UnitLabel
    | null
    | undefined
  const initialForms =
    initialLabel?.['en'] ?? Object.values(initialLabel ?? {})[0] ?? {}
  const [singular, setSingular] = useState(initialForms['=1'] ?? '')
  const [plural, setPlural] = useState(initialForms['other'] ?? '')

  return (
    <FormField
      control={control}
      name={`prices.${index}.unit_label`}
      rules={{ validate: (value) => validateUnitLabel(value as UnitLabel) }}
      render={({ field }) => {
        const updateLabel = (nextSingular: string, nextPlural: string) => {
          setSingular(nextSingular)
          setPlural(nextPlural)
          field.onChange(
            composeUnitLabel(
              field.value as UnitLabel | null,
              nextSingular,
              nextPlural,
            ),
          )
          setValue(`prices.${index}.id`, '')
        }

        return (
          <FormItem>
            <FormLabel>Unit name</FormLabel>
            <FormDescription>
              What customers see instead of &ldquo;unit&rdquo; at checkout and
              on invoices. Leave blank to use the default.
            </FormDescription>
            <Grid templateColumns="repeat(2, 1fr)" columnGap="m">
              <FormItem>
                <FormLabel>Singular</FormLabel>
                <FormControl>
                  <Input
                    value={singular}
                    placeholder="device"
                    autoComplete="off"
                    onChange={(e) => updateLabel(e.target.value, plural)}
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
                    onChange={(e) => updateLabel(singular, e.target.value)}
                  />
                </FormControl>
              </FormItem>
            </Grid>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
