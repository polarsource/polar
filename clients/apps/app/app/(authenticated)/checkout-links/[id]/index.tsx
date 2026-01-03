import { AddMetadataSheet } from '@/components/CheckoutLinks/AddMetadataSheet'
import { CheckoutLinkHeader } from '@/components/CheckoutLinks/Details/CheckoutLinkHeader'
import { DiscountField } from '@/components/CheckoutLinks/Details/DiscountField'
import { LinkEmbedSection } from '@/components/CheckoutLinks/Details/LinkEmbedSection'
import { MetadataCard } from '@/components/CheckoutLinks/Details/MetadataCard'
import { ProductsField } from '@/components/CheckoutLinks/Details/ProductsField'
import { SettingsCard } from '@/components/CheckoutLinks/Details/SettingsCard'
import { TrialPeriodCard } from '@/components/CheckoutLinks/Details/TrialPeriodCard'
import { DiscountSelectionSheet } from '@/components/CheckoutLinks/DiscountSelectionSheet'
import { ProductSelectionSheet } from '@/components/CheckoutLinks/ProductSelectionSheet'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { Input } from '@/components/Shared/Input'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import {
  useCheckoutLink,
  useCheckoutLinkUpdate,
} from '@/hooks/polar/checkout_links'
import { useInfiniteDiscounts } from '@/hooks/polar/discounts'
import { useInfiniteProducts } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useToast } from '@/providers/ToastProvider'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native'

type CheckoutLinkUpdateForm = {
  label: string
  success_url: string
  allow_discount_codes: boolean
  require_billing_address: boolean
  metadata: { key: string; value: string }[]
}

export default function CheckoutLinkDetails() {
  const { id } = useLocalSearchParams()
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)
  const toast = useToast()

  const {
    data: checkoutLink,
    refetch,
    isRefetching,
  } = useCheckoutLink(organization?.id, id as string)

  const updateCheckoutLink = useCheckoutLinkUpdate(
    organization?.id,
    id as string,
  )

  const { data: productsData } = useInfiniteProducts(organization?.id, {
    is_archived: false,
  })
  const allProducts = useMemo(
    () => productsData?.pages.flatMap((page) => page.items) ?? [],
    [productsData],
  )

  useInfiniteDiscounts(organization?.id, {
    sorting: ['name'],
  })

  const defaultValues = useMemo<CheckoutLinkUpdateForm>(
    () => ({
      label: checkoutLink?.label ?? '',
      success_url: checkoutLink?.success_url ?? '',
      allow_discount_codes: checkoutLink?.allow_discount_codes ?? true,
      require_billing_address: checkoutLink?.require_billing_address ?? false,
      metadata: Object.entries(checkoutLink?.metadata ?? {}).map(
        ([key, value]) => ({
          key,
          value: String(value),
        }),
      ),
    }),
    [checkoutLink],
  )

  const { control, handleSubmit, reset } = useForm<CheckoutLinkUpdateForm>({
    defaultValues,
  })

  useEffect(() => {
    if (checkoutLink) {
      reset(defaultValues)
    }
  }, [checkoutLink, reset, defaultValues])

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [showProductSheet, setShowProductSheet] = useState(false)

  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(
    null,
  )
  const [selectedDiscountName, setSelectedDiscountName] = useState<
    string | null
  >(null)
  const [showDiscountSheet, setShowDiscountSheet] = useState(false)

  const [metadataFields, setMetadataFields] = useState<
    { key: string; value: string }[]
  >([])
  const [showAddMetadataSheet, setShowAddMetadataSheet] = useState(false)

  useEffect(() => {
    if (checkoutLink) {
      setSelectedProductIds(checkoutLink.products.map((p) => p.id))
      setSelectedDiscountId(checkoutLink.discount?.id ?? null)
      setSelectedDiscountName(checkoutLink.discount?.name ?? null)
      setMetadataFields(
        Object.entries(checkoutLink.metadata).map(([key, value]) => ({
          key,
          value: String(value),
        })),
      )
    }
  }, [checkoutLink])

  const selectedProductNames = useMemo(() => {
    return selectedProductIds
      .map((id) => allProducts.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[]
  }, [selectedProductIds, allProducts])

  const onSubmit = useCallback(
    async (data: CheckoutLinkUpdateForm) => {
      if (selectedProductIds.length === 0) {
        Alert.alert('Error', 'Please select at least one product')
        return
      }

      try {
        await updateCheckoutLink.mutateAsync({
          label: data.label || null,
          success_url: data.success_url || null,
          allow_discount_codes: data.allow_discount_codes,
          require_billing_address: data.require_billing_address,
          products: selectedProductIds,
          discount_id: selectedDiscountId,
          metadata: metadataFields.reduce(
            (acc, { key, value }) => {
              if (key) {
                acc[key] = value
              }
              return acc
            },
            {} as Record<string, string>,
          ),
        })

        toast.showInfo('Saved!')
      } catch {
        Alert.alert('Error', 'Failed to update checkout link')
      }
    },
    [
      selectedProductIds,
      updateCheckoutLink,
      selectedDiscountId,
      metadataFields,
      toast,
    ],
  )

  const addMetadataField = useCallback((key: string, value: string) => {
    setMetadataFields((prev) => [...prev, { key, value }])
  }, [])

  const removeMetadataField = useCallback((index: number) => {
    setMetadataFields((prev) => prev.filter((_, i) => i !== index))
  }, [])

  if (!checkoutLink) {
    return (
      <Stack.Screen
        options={{
          title: 'Checkout Link',
        }}
      />
    )
  }

  const productLabel =
    selectedProductIds.length === 1
      ? (selectedProductNames[0] ?? '1 Product')
      : `${selectedProductIds.length} Products`

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{
            flex: 1,
            padding: theme.spacing['spacing-16'],
            backgroundColor: theme.colors.background,
          }}
          contentContainerStyle={{
            flexDirection: 'column',
            gap: theme.spacing['spacing-24'],
            paddingBottom: theme.spacing['spacing-48'],
          }}
          refreshControl={
            <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
          }
          keyboardShouldPersistTaps="handled"
        >
          <Stack.Screen
            options={{
              title: checkoutLink.label || 'Untitled',
            }}
          />

          <CheckoutLinkHeader
            label={checkoutLink.label}
            productLabel={productLabel}
          />

          <LinkEmbedSection url={checkoutLink.url} />

          <Box flexDirection="column" gap="spacing-8">
            <Text variant="bodyMedium" color="subtext">
              Label
            </Text>
            <Controller
              control={control}
              name="label"
              render={({ field: { onChange, value } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  placeholder="Internal label (optional)"
                />
              )}
            />
          </Box>

          <ProductsField
            productNames={selectedProductNames}
            productCount={selectedProductIds.length}
            onPress={() => setShowProductSheet(true)}
          />

          <Box flexDirection="column" gap="spacing-8">
            <Text variant="bodyMedium" color="subtext">
              Success URL
            </Text>
            <Controller
              control={control}
              name="success_url"
              render={({ field: { onChange, value } }) => (
                <Input
                  value={value}
                  onChangeText={onChange}
                  placeholder="https://example.com/success?checkout_id={CHECKOUT_ID}"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              )}
            />
            <Text variant="bodySmall" color="subtext">
              Include {'{CHECKOUT_ID}'} to receive the Checkout ID on success.
            </Text>
          </Box>

          <DiscountField
            discountId={selectedDiscountId}
            discountName={selectedDiscountName}
            onPress={() => setShowDiscountSheet(true)}
          />

          <SettingsCard control={control} />

          {checkoutLink.trial_interval ? (
            <TrialPeriodCard
              interval={checkoutLink.trial_interval}
              intervalCount={checkoutLink.trial_interval_count ?? 0}
            />
          ) : null}

          <MetadataCard
            fields={metadataFields}
            onAdd={() => setShowAddMetadataSheet(true)}
            onRemove={removeMetadataField}
          />

          <Button
            onPress={() => {
              handleSubmit(onSubmit)()
            }}
            loading={updateCheckoutLink.isPending}
          >
            Save
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {showProductSheet ? (
        <ProductSelectionSheet
          onDismiss={() => setShowProductSheet(false)}
          onSelect={setSelectedProductIds}
          selectedProductIds={selectedProductIds}
        />
      ) : null}

      {showDiscountSheet ? (
        <DiscountSelectionSheet
          onDismiss={() => setShowDiscountSheet(false)}
          onSelect={(discount) => {
            setSelectedDiscountId(discount?.id ?? null)
            setSelectedDiscountName(discount?.name ?? null)
          }}
          selectedDiscountId={selectedDiscountId}
        />
      ) : null}

      {showAddMetadataSheet ? (
        <AddMetadataSheet
          onDismiss={() => setShowAddMetadataSheet(false)}
          onAdd={addMetadataField}
        />
      ) : null}
    </>
  )
}
