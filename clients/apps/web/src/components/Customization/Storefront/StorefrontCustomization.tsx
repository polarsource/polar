'use client'

import { schemas } from '@polar-sh/client'
import { StorefrontPreview } from './StorefrontPreview'

export const StorefrontCustomization = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  return <StorefrontPreview organization={organization} />
}
