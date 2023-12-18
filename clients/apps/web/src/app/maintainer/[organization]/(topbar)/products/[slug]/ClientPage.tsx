'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useParams } from 'next/navigation'
import {
  Input,
  MoneyInput,
  ShadowBoxOnMd,
  TextArea,
} from 'polarkit/components/ui/atoms'
import { productMocks } from '../ClientPage'

const ClientPage = () => {
  const { slug } = useParams()
  const product = productMocks.find((product) => product.slug === slug)

  if (!product) {
    return null
  }

  return (
    <DashboardBody>
      <ShadowBoxOnMd className="flex w-2/3 flex-col gap-y-6">
        <h2 className="text-lg font-medium">Edit Product</h2>
        <div className="flex flex-col items-start gap-y-6">
          <div className="flex min-w-[260px] flex-col gap-y-2">
            <span className="text-sm">Name</span>
            <Input placeholder="Name" defaultValue={product.name} />
          </div>
          <div className="flex w-full flex-col gap-y-2">
            <span className="text-sm">Description</span>
            <TextArea
              placeholder="Description"
              defaultValue={product.description}
            />
          </div>
          <div className="flex min-w-[260px] flex-col gap-y-2">
            <span className="text-sm">Price</span>
            <MoneyInput
              id="price"
              name="price"
              placeholder={0}
              value={product.price}
            />
          </div>
        </div>
      </ShadowBoxOnMd>
    </DashboardBody>
  )
}

export default ClientPage
