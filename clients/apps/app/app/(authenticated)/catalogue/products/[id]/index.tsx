import { FormInput } from '@/components/Form/FormInput'
import { Box as MetricsBox } from '@/components/Metrics/Box'
import { OrderRow } from '@/components/Orders/OrderRow'
import { Banner } from '@/components/Shared/Banner'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { EmptyState } from '@/components/Shared/EmptyState'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/Shared/Tabs'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useMetrics } from '@/hooks/polar/metrics'
import { useOrders } from '@/hooks/polar/orders'
import { useProduct, useProductUpdate } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useToast } from '@/providers/ToastProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { schemas } from '@polar-sh/client'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { RefreshControl, ScrollView } from 'react-native'

export interface ProductFullMediasMixin {
  full_medias: schemas['ProductMediaFileRead'][]
}

type ProductUpdateForm = Omit<schemas['ProductUpdate'], 'metadata'> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

export default function Index() {
  const { id } = useLocalSearchParams()
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)
  const toast = useToast()

  const {
    data: product,
    refetch,
    isRefetching,
  } = useProduct(organization?.id, id as string)

  const now = useMemo(() => new Date(), [])

  const { data: metrics } = useMetrics(
    organization?.id,
    new Date(organization?.created_at ?? ''),
    now,
    {
      product_id: id as string,
      interval: 'month',
    },
  )

  const { data: latestProductOrders } = useOrders(organization?.id, {
    product_id: id as string,
    limit: 3,
  })

  const flatLatestProductOrders = latestProductOrders?.pages.flatMap(
    (page) => page.items,
  )

  const form = useForm<ProductUpdateForm>({
    defaultValues: {
      ...product,
      medias: product?.medias.map((media) => media.id),
      full_medias: product?.medias,
      metadata: Object.entries(product?.metadata ?? {}).map(([key, value]) => ({
        key,
        value,
      })),
    },
  })

  const { control, handleSubmit, formState, reset } = form

  useEffect(() => {
    if (product) {
      reset({
        ...product,
        medias: product.medias.map((media) => media.id),
        full_medias: product.medias,
        metadata: Object.entries(product.metadata ?? {}).map(
          ([key, value]) => ({
            key,
            value,
          }),
        ),
      })
    }
  }, [product, reset])

  const updateProduct = useProductUpdate(organization?.id, id as string)

  const { error: mutationError } = updateProduct

  if (mutationError) {
    throw mutationError
  }

  const saveProduct = useCallback(
    async (data: ProductUpdateForm) => {
      const result = await updateProduct.mutateAsync({
        ...data,
        metadata: Object.fromEntries(
          data.metadata.map(({ key, value }) => [key, value]),
        ),
      })

      reset({
        ...result,
        medias: result.medias.map((media) => media.id),
        full_medias: result.medias,
        metadata: Object.entries(result.metadata).map(([key, value]) => ({
          key,
          value,
        })),
      })

      toast.showInfo('Saved!')
    },
    [reset, updateProduct],
  )

  if (!product) {
    return (
      <Stack.Screen
        options={{
          title: 'Product',
        }}
      />
    )
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        padding: theme.spacing['spacing-16'],
        backgroundColor: theme.colors.background,
      }}
      contentContainerStyle={{
        flexDirection: 'column',
        gap: theme.spacing['spacing-32'],
        paddingBottom: theme.spacing['spacing-48'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          title: product.name,
        }}
      />

      <Tabs defaultValue="overview">
        {product.is_archived ? (
          <Banner
            title="This product is archived"
            description="Archived products cannot be edited, nor can they be unarchived."
          />
        ) : (
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>
        )}
        <TabsContent
          value="overview"
          style={{ flexDirection: 'column', gap: theme.spacing['spacing-32'] }}
        >
          <Box flexDirection="row" gap="spacing-16">
            <MetricsBox
              label="Orders"
              value={(
                metrics?.periods.reduce(
                  (acc, period) => acc + (period.orders ?? 0),
                  0,
                ) ?? 0
              ).toString()}
            />
            <MetricsBox
              label="Revenue"
              value={formatCurrencyAndAmount(
                metrics?.periods[metrics?.periods.length - 1]
                  .cumulative_revenue ?? 0,
              )}
            />
          </Box>

          <Box flexDirection="column" gap="spacing-16">
            <Text variant="title">Latest orders</Text>
            <Box flexDirection="column" gap="spacing-8">
              {(flatLatestProductOrders?.length ?? 0) > 0 ? (
                flatLatestProductOrders?.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))
              ) : (
                <EmptyState
                  title="No orders found"
                  description="No orders found for this product"
                />
              )}
            </Box>
          </Box>
        </TabsContent>
        <TabsContent
          value="edit"
          style={{ flexDirection: 'column', gap: theme.spacing['spacing-32'] }}
        >
          <Box flexDirection="column" gap="spacing-16">
            <FormInput control={control} name="name" label="Name" />
            <FormInput
              multiline
              control={control}
              name="description"
              style={{ height: theme.dimension['dimension-120'] }}
              label="Description"
              secondaryLabel="Markdown"
            />
          </Box>
          <Button
            onPress={handleSubmit(saveProduct)}
            loading={updateProduct.isPending}
            disabled={!formState.isDirty}
          >
            Save
          </Button>
        </TabsContent>
      </Tabs>
    </ScrollView>
  )
}
