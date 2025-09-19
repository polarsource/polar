'use client'

import { Section } from '@/components/Layout/Section'
import { TrialConfigurationForm } from '@/components/TrialConfiguration/TrialConfigurationForm'
import { schemas } from '@polar-sh/client'
import { useFormContext } from 'react-hook-form'

interface ProductTrialSectionProps {
  className?: string
  compact?: boolean
}

export const ProductTrialSection = ({
  className,
  compact,
}: ProductTrialSectionProps) => {
  const { watch } = useFormContext<schemas['ProductCreateRecurring']>()
  const recurringInterval = watch('recurring_interval')

  if (!recurringInterval) {
    return null
  }

  return (
    <Section
      title="Trial Period"
      description="Configure a free trial period for this product"
      className={className}
      compact={compact}
    >
      <TrialConfigurationForm />
    </Section>
  )
}
