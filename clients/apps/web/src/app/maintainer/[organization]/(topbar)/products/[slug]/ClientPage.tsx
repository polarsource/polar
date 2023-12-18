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
      <div className="flex w-full flex-col gap-y-8">
        <ShadowBoxOnMd>
          <div className="flex flex-col gap-y-4">
            <Input placeholder="Name" defaultValue={product.name} />
            <TextArea
              placeholder="Description"
              defaultValue={product.description}
            />
            <MoneyInput
              id="price"
              name="price"
              placeholder={0}
              value={product.price}
            />
          </div>
        </ShadowBoxOnMd>
      </div>
    </DashboardBody>
  )
}

export default ClientPage
