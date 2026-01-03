import { AddMetadataSheet } from '@/components/CheckoutLinks/AddMetadataSheet'
import { DiscountField } from '@/components/CheckoutLinks/Details/DiscountField'
import { MetadataCard } from '@/components/CheckoutLinks/Details/MetadataCard'
import { ProductsField } from '@/components/CheckoutLinks/Details/ProductsField'
import { SettingsCard } from '@/components/CheckoutLinks/Details/SettingsCard'
import { DiscountSelectionSheet } from '@/components/CheckoutLinks/DiscountSelectionSheet'
import { ProductSelectionSheet } from '@/components/CheckoutLinks/ProductSelectionSheet'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { Input } from '@/components/Shared/Input'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { useCheckoutLinkCreate } from '@/hooks/polar/checkout_links'
import { useInfiniteDiscounts } from '@/hooks/polar/discounts'
import { useInfiniteProducts } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useToast } from '@/providers/ToastProvider'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useContext, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'

type CheckoutLinkCreateForm = {
  label: string
  success_url: string
  allow_discount_codes: boolean
  require_billing_address: boolean
  metadata: { key: string; value: string }[]
}

export default function CreateCheckoutLink() {
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)
  const toast = useToast()
  const router = useRouter()

  const createCheckoutLink = useCheckoutLinkCreate(organization?.id)

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

  const defaultValues: CheckoutLinkCreateForm = {
    label: '',
    success_url: '',
    allow_discount_codes: true,
    require_billing_address: false,
    metadata: [],
  }

  const { control, handleSubmit } = useForm<CheckoutLinkCreateForm>({
    defaultValues,
  })

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

  const selectedProductNames = useMemo(() => {
    return selectedProductIds
      .map((id) => allProducts.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[]
  }, [selectedProductIds, allProducts])

  const onSubmit = useCallback(
    async (data: CheckoutLinkCreateForm) => {
      if (selectedProductIds.length === 0) {
        Alert.alert('Error', 'Please select at least one product')
        return
      }

      try {
        const result = await createCheckoutLink.mutateAsync({
          payment_processor: 'stripe',
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

        toast.showInfo('Checkout link created!')
        router.push(`/checkout-links`)
      } catch {
        Alert.alert('Error', 'Failed to create checkout link')
      }
    },
    [
      selectedProductIds,
      createCheckoutLink,
      selectedDiscountId,
      metadataFields,
      toast,
      router,
    ],
  )

  const addMetadataField = useCallback((key: string, value: string) => {
    setMetadataFields((prev) => [...prev, { key, value }])
  }, [])

  const removeMetadataField = useCallback((index: number) => {
    setMetadataFields((prev) => prev.filter((_, i) => i !== index))
  }, [])

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
          keyboardShouldPersistTaps="handled"
        >
          <Stack.Screen
            options={{
              title: 'New Checkout Link',
            }}
          />

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
                  placeholder="My Checkout Link"
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

          <MetadataCard
            fields={metadataFields}
            onAdd={() => setShowAddMetadataSheet(true)}
            onRemove={removeMetadataField}
          />

          <Button
            onPress={() => {
              handleSubmit(onSubmit)()
            }}
            loading={createCheckoutLink.isPending}
          >
            Create
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
