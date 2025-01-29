'use client'

import { Section } from '@/components/Layout/Section'
import { Organization } from '@polar-sh/api'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'
import ProductMediasField from '../ProductMediasField'
import { ProductFormType } from './ProductForm'

export interface ProductMediaSectionProps {
  className?: string
  organization: Organization
  compact?: boolean
}

export const ProductMediaSection = ({
  className,
  organization,
  compact,
}: ProductMediaSectionProps) => {
  const { control } = useFormContext<ProductFormType>()

  return (
    <Section
      title="Media"
      description="Enhance the product page with medias, giving the customers a better idea of the product"
      className={className}
    >
      <FormField
        control={control}
        name="full_medias"
        render={({ field }) => (
          <FormItem className="flex w-full flex-col gap-2">
            <FormControl>
              <ProductMediasField
                organization={organization}
                value={field.value}
                onChange={field.onChange}
                compact={compact}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Section>
  )
}
