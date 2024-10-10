'use client'

import { Section } from '@/components/Layout/Section'
import { AspectRatioOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useFormContext } from 'react-hook-form'
import ProductMediasField from '../ProductMediasField'
import { ProductFormType } from './ProductForm'

export interface ProductMediaSectionProps {
  className?: string
  organization: Organization
}

export const ProductMediaSection = ({
  className,
  organization,
}: ProductMediaSectionProps) => {
  const { control } = useFormContext<ProductFormType>()

  return (
    <Section
      icon={<AspectRatioOutlined fontSize="medium" />}
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
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Section>
  )
}
