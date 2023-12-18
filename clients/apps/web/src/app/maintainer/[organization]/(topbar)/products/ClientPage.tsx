'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ProductTile } from '@/components/Product/ProductTile'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { AddOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import { productMocks } from './data'

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()

  return (
    <DashboardBody>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-medium">Overview</h2>
          <Link href={`/maintainer/${org?.name}/products/new`}>
            <Button className="h-8 w-8 rounded-full">
              <AddOutlined fontSize="inherit" />
            </Button>
          </Link>
        </div>
        <StaggerReveal className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
          {productMocks.map((product) => (
            <StaggerReveal.Child
              key={product.id}
              className="flex flex-grow flex-col"
            >
              <Link href={`/maintainer/${org?.name}/products/${product.slug}`}>
                <ProductTile product={product} />
              </Link>
            </StaggerReveal.Child>
          ))}
        </StaggerReveal>
      </div>
    </DashboardBody>
  )
}

export default ClientPage
