'use client'

import { Section } from '@/components/Layout/Section'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import {
  FormField,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from './ProductForm'

export interface ProductEmailSectionProps {
  className?: string
  compact?: boolean
}

export const ProductEmailSection = ({
  className,
  compact,
}: ProductEmailSectionProps) => {
  const { control } = useFormContext<ProductFormType>()

  return (
    <Section
      title="Purchase Email"
      description="Customize the purchase confirmation email"
      className={className}
      compact={compact}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Message
          </label>
          <FormField
            control={control}
            name="purchase_email_thank_you_note"
            render={({ field }) => (
              <div>
                <TextArea
                  {...field}
                  value={field.value || ''}
                  placeholder="Thank you for choosing our product! We truly appreciate your support and trust in our solution."
                  rows={3}
                  className="resize-none"
                  maxLength={500}
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    After purchase, customers will receive an email with this note
                  </p>
                  <span className="text-xs text-gray-500">
                    {(field.value as string)?.length || 0}/500 characters
                  </span>
                </div>
                <FormMessage />
              </div>
            )}
          />
        </div>
      </div>
    </Section>
  )
}
