import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useMetrics, useUpdateProduct } from '@/hooks/queries'
import { getChartRangeParams } from '@/utils/metrics'
import { MoreVert } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { DashboardBody } from '../../Layout/DashboardLayout'
import { ProductThumbnail } from '../ProductThumbnail'
import { ProductMetricsView } from './ProductMetricsView'
import { ProductOverview } from './ProductOverview'
import { ProductPageContextView } from './ProductPageContextView'

const ProductTypeDisplayColor: Record<string, string> = {
  subscription: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  one_time:
    'bg-indigo-100 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-400',
}

export interface ProductPageProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductPage = ({ organization, product }: ProductPageProps) => {
  const [allTimeStart, allTimeEnd, allTimeInterval] = getChartRangeParams(
    'all_time',
    product.created_at,
  )
  const { data: metrics, isLoading: metricsLoading } = useMetrics({
    organization_id: organization.id,
    product_id: [product.id],
    startDate: allTimeStart,
    endDate: allTimeEnd,
    interval: allTimeInterval,
  })
  const { data: todayMetrics } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    product_id: [product.id],
  })

  const updateProduct = useUpdateProduct(organization)
  const router = useRouter()

  const {
    isShown: isArchiveModalShown,
    hide: hideArchiveModal,
    show: showArchiveModal,
  } = useModal()

  const handleArchiveProduct = useCallback(async () => {
    await updateProduct.mutateAsync({
      id: product.id,
      body: { is_archived: true },
    })

    router.push(`/dashboard/${organization.slug}/products`)
  }, [product, updateProduct, organization, router])

  return (
    <Tabs defaultValue="overview" className="h-full">
      <DashboardBody
        title={
          <div className="flex flex-row items-center gap-6">
            <div className="flex flex-row items-center gap-4">
              <ProductThumbnail product={product} />
              <h1 className="text-2xl">{product.name}</h1>
            </div>
            <div className="flex flex-row items-center gap-4">
              <Status
                status={
                  product.is_recurring ? 'Subscription' : 'One-time Product'
                }
                className={
                  ProductTypeDisplayColor[
                    product.is_recurring ? 'subscription' : 'one_time'
                  ]
                }
              />
              {product.is_archived && (
                <Status
                  status="Archived"
                  className="bg-red-100 text-red-500 dark:bg-red-950"
                />
              )}
            </div>
          </div>
        }
        header={
          !product.is_archived ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="secondary">
                  <MoreVert fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    if (typeof navigator !== 'undefined') {
                      navigator.clipboard.writeText(product.id)

                      toast({
                        title: 'Product ID Copied',
                        description: 'Product ID copied to clipboard',
                      })
                    }
                  }}
                >
                  Copy Product ID
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    router.push(
                      `/dashboard/${organization.slug}/onboarding/integrate?productId=${product.id}`,
                    )
                  }}
                >
                  Integrate Checkout
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={showArchiveModal}>
                  Archive Product
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
        contextViewClassName="hidden md:block"
        contextView={
          product.is_archived ? undefined : (
            <ProductPageContextView
              organization={organization}
              product={product}
            />
          )
        }
        wide
      >
        <TabsList className="pb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ProductOverview
            metrics={metrics}
            todayMetrics={todayMetrics}
            organization={organization}
            product={product}
          />
        </TabsContent>
        <TabsContent value="metrics">
          <ProductMetricsView
            data={metrics}
            interval={allTimeInterval}
            loading={metricsLoading}
          />
        </TabsContent>
        <ConfirmModal
          title="Archive Product"
          description="Archiving a product will not affect its current customers, only prevent new subscribers and purchases."
          onConfirm={handleArchiveProduct}
          isShown={isArchiveModalShown}
          hide={hideArchiveModal}
          destructiveText="Archive"
          destructive
        />
      </DashboardBody>
    </Tabs>
  )
}
