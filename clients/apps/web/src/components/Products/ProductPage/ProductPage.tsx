import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useIsManagedAsCode } from '@/hooks/permissions'
import { useDeleteProduct, useMetrics, useUpdateProduct } from '@/hooks/queries'
import { apiErrorToast, extractApiErrorMessage } from '@/utils/api/errors'
import { getChartRangeParams } from '@/utils/metrics'
import { MoreVert } from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Button, Status } from '@polar-sh/orbit'
import { Subnav, SubnavItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { DashboardBody } from '../../Layout/DashboardLayout'
import { ProductMetricsView } from './ProductMetricsView'
import { ProductOverview } from './ProductOverview'

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

  const [tab, setTab] = useState<'overview' | 'metrics'>('overview')

  const updateProduct = useUpdateProduct(organization)
  const deleteProduct = useDeleteProduct(organization)
  const managedAsCode = useIsManagedAsCode(organization.id)
  const router = useRouter()
  const safeCopy = useSafeCopy(toast)

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

  const {
    isShown: isDeleteModalShown,
    hide: hideDeleteModal,
    show: showDeleteModal,
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

  const handleDeleteProduct = useCallback(async () => {
    const { error } = await deleteProduct.mutateAsync(product)

    if (error) {
      toast({
        title: 'Error Deleting Product',
        description: extractApiErrorMessage(error),
      })
      return
    }

    toast({
      title: 'Product Deleted',
      description: 'Product has been permanently deleted',
    })
    router.push(`/dashboard/${organization.slug}/products`)
  }, [product, deleteProduct, router, organization])

  return (
    <DashboardBody
      title={
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-row items-center gap-4">
            <h1 className="truncate text-2xl">{product.name}</h1>
            {product.is_archived && <Status status="Archived" color="gray" />}
          </div>
          <span className="dark:text-polar-500 text-xl text-gray-400 [&_*]:!text-current">
            <ProductPriceLabel
              product={product}
              currency={organization.default_presentment_currency}
              fullInterval
            />
          </span>
        </div>
      }
      header={
        <div className="flex flex-row items-center justify-between gap-2">
          {product.is_archived || managedAsCode ? null : (
            <div>
              <Button
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
                <Button className="aspect-square h-10 w-10" variant="secondary">
                  <MoreVert fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    void safeCopy(product.id).then(() =>
                      toast({
                        title: 'Product ID Copied',
                        description: 'Product ID copied to clipboard',
                      }),
                    )
                  }
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
                    {!managedAsCode && (
                      <>
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
                        <DropdownMenuItem
                          destructive
                          onClick={showArchiveModal}
                        >
                          Archive Product
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
                {product.is_archived && !managedAsCode && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={showUnarchiveModal}>
                      Unarchive Product
                    </DropdownMenuItem>
                    {product.is_deletable && (
                      <DropdownMenuItem destructive onClick={showDeleteModal}>
                        Delete Permanently
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      }
    >
      <Box flexDirection="column" rowGap="2xl">
        <Subnav label="Product sections">
          {(['overview', 'metrics'] as const).map((value) => (
            <SubnavItem key={value} active={tab === value}>
              <button
                type="button"
                className="cursor-pointer capitalize"
                onClick={() => setTab(value)}
              >
                {value}
              </button>
            </SubnavItem>
          ))}
        </Subnav>
        {tab === 'overview' ? (
          <ProductOverview
            metrics={metrics}
            todayMetrics={todayMetrics}
            organization={organization}
            product={product}
          />
        ) : (
          <ProductMetricsView
            data={metrics}
            interval={allTimeInterval}
            loading={metricsLoading}
            product={product}
          />
        )}
      </Box>
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
      <ConfirmModal
        title="Delete Product"
        description="This product has never been sold and will be permanently deleted. This action cannot be undone."
        onConfirm={handleDeleteProduct}
        isShown={isDeleteModalShown}
        hide={hideDeleteModal}
        confirmPrompt={product.name}
        destructiveText="Delete"
        destructive
      />
    </DashboardBody>
  )
}
