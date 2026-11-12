import { ProductVersionLabel } from '@/components/Products/ProductVersionLabel'
import { schemas } from '@polar-sh/client'

export const MeterVersionLabel = ({
  organization,
  meter,
}: {
  organization: schemas['Organization']
  meter: schemas['Meter']
}) => <ProductVersionLabel organization={organization} product={meter} />
