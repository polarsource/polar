import { Section } from '@/components/Layout/Section'
import { ProductMetadataForm } from '../ProductMetadataForm'

export interface ProductMetadataSectionProps {
  className?: string
  compact?: boolean
}

export const ProductMetadataSection = ({
  className,
  compact,
}: ProductMetadataSectionProps) => {
  return (
    <Section
      title="Metadata"
      description="Optional metadata to associate with the product"
      className={className}
      compact={compact}
    >
      <ProductMetadataForm />
    </Section>
  )
}
