'use client'

import { productMocks } from '@/app/maintainer/[organization]/(topbar)/products/data'
import { FileDownloadOutlined } from '@mui/icons-material'
import { useParams } from 'next/navigation'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'

export default function Page() {
  const { id } = useParams()

  const product = productMocks.find((product) => product.id === id)

  if (!product) return null

  return (
    <div className="relative flex flex-row items-start gap-x-12">
      <ShadowBoxOnMd className="w-1/4"></ShadowBoxOnMd>
      <div className="flex w-3/4 flex-col gap-y-8 pb-12">
        <div className="flex flex-col gap-y-2">
          <div className="dark:bg-polar-900 dark:border-polar-800 dark:hover:bg-polar-800 flex flex-row justify-between rounded-3xl border border-gray-100 bg-white p-4 pr-8 shadow-sm transition-colors hover:bg-gray-50">
            <div className="flex flex-row items-center gap-x-4">
              <div
                className="dark:bg-polar-700 aspect-square w-16 rounded-2xl bg-gray-100 bg-cover bg-center"
                style={{ backgroundImage: `url(${product.image})` }}
              />
              <div className="flex flex-col">
                <h3 className="font-medium">{product.name}</h3>
                <div className="dark:text-polar-500 flex flex-row gap-x-1 text-sm text-gray-500">
                  <span>{product.type}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-row items-center gap-x-4">
              <Button className="h-8 w-8 rounded-full" variant="secondary">
                <FileDownloadOutlined fontSize="small" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
