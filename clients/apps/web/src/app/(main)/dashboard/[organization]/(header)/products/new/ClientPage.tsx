'use client'

import { CreateProductPage } from '@/components/Products/CreateProductPage'
import { schemas } from '@polar-sh/client'

export default function Page({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return <CreateProductPage organization={organization} />
}
