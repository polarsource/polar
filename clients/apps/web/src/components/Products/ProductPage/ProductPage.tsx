import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useMetrics, useUpdateProduct } from '@/hooks/queries'
import { apiErrorToast } from '@/utils/api/errors'
import { getChartRangeParams } from '@/utils/metrics'
import MoreVert from '@mui/icons-material/MoreVert'
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
    metrics: product.is_recurring
      ? [
          // Subscription metrics
          'monthly_recurring_revenue',
          'committed_monthly_recurring_revenue',
          'active_subscriptions',
          'new_subscriptions',
          'renewed_subscriptions',
          'new_subscriptions_revenue',
          'renewed_subscriptions_revenue',
          // Order metrics
          'revenue',
          'orders',
          'average_order_value',
          'cumulative_revenue',
        ]
      : [
          // One-time metrics
          'one_time_products',
          'one_time_products_revenue',
          // Order metrics (excluding revenue and orders for one-time)
          'average_order_value',
          'cumulative_revenue',
        ],
  })
  const { data: todayMetrics } = useMetrics({
    organization_id: organization.id,
    startDate: new Date(),
    endDate: new Date(),
    interval: 'day',
    product_id: [product.id],
    metrics: ['revenue'],
  })

  const updateProduct = useUpdateProduct(organization)
  const router = useRouter()

  const {
    isShown: isArchiveModalShown,
    hide: hideArchiveModal,
    show: showArchiveModal,
  } = useModal()

  const {
    isShown: isUnarchiveModalShown,
    hide: hideUnarchiveModal,
    show: showUnarchiveModal,
  } = useModal()

  const handleArchiveProduct = useCallback(async () => {
    const { error } = await updateProduct.mutateAsync({
      id: product.id,
      body: { is_archived: true },
    })

    if (error) {
      apiErrorToast(error, toast, {
        title: 'Error Archiving Product',
      })
      return
    }

    toast({
      title: 'Product Archived',
      description: 'Product has been successfully archived',
    })
  }, [product, updateProduct])

  const handleUnarchiveProduct = useCallback(async () => {
    const { error } = await updateProduct.mutateAsync({
      id: product.id,
      body: { is_archived: false },
    })

    if (error) {
      apiErrorToast(error, toast, {
        title: 'Error Unarchiving Product',
      })
      return
    }

    toast({
      title: 'Product Unarchived',
      description: 'Product has been successfully unarchived',
    })
  }, [product, updateProduct])

  return (
    <Tabs defaultValue="overview" className="h-full">
      <DashboardBody
        title={
          <div className="flex min-w-0 flex-row items-center gap-4">
            <div className="flex min-w-0 flex-row items-center gap-4">
              <ProductThumbnail product={product} />
              <h1 className="truncate text-2xl">{product.name}</h1>
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
          <div className="flex flex-row items-center justify-between gap-2">
            {product.is_archived ? null : (
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    router.push(
                      `/dashboard/${organization.slug}/products/${product.id}/edit`,
                    )
                  }}
                >
                  Edit Product
                </Button>
              </div>
            )}
            <div>
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
                  {!product.is_archived && (
                    <>
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
                      <DropdownMenuItem
                        onClick={() => {
                          router.push(
                            `/dashboard/${organization.slug}/products/new?fromProductId=${product.id}`,
                          )
                        }}
                      >
                        Duplicate Product
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onClick={showArchiveModal}>
                        Archive Product
                      </DropdownMenuItem>
                    </>
                  )}
                  {product.is_archived && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={showUnarchiveModal}>
                        Unarchive Product
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        }
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
            product={product}
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
        <ConfirmModal
          title="Unarchive Product"
          description="Unarchiving this product will make it available for new subscribers and purchases again."
          onConfirm={handleUnarchiveProduct}
          isShown={isUnarchiveModalShown}
          hide={hideUnarchiveModal}
          destructiveText="Unarchive"
        />
      </DashboardBody>
    </Tabs>
  )
}
