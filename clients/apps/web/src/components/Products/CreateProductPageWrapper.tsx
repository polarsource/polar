import { useProduct } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { DashboardBody } from '../Layout/DashboardLayout'
import { CreateProductPage } from './CreateProductPage'

interface CreateProductPageWrapperProps {
  organization: schemas['Organization']
  fromProductId?: string
}

export const CreateProductPageWrapper = ({
  organization,
  fromProductId,
}: CreateProductPageWrapperProps) => {
  const { data: sourceProduct, isLoading } = useProduct(fromProductId)

  if (fromProductId && isLoading) {
    return (
      <DashboardBody
        title="Duplicate Product"
        wrapperClassName="max-w-(--breakpoint-md)!"
        className="gap-y-16"
      >
        <div className="flex items-center justify-center py-16">
          <p className="dark:text-polar-500 text-gray-500">
            Loading product...
          </p>
        </div>
      </DashboardBody>
    )
  }

  if (fromProductId && !sourceProduct) {
    return null
  }

  return (
    <CreateProductPage
      organization={organization}
      sourceProduct={sourceProduct}
    />
  )
}
