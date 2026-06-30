import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { ProductCatalogue } from '@/components/ProductCatalogue'
import React from 'react'

export default function ProductsPage() {
  return (
    <AppShell>
      <Box display="flex" flexDirection="column" rowGap="3xl" paddingTop="m">
        <Box display="flex" alignItems="center" justifyContent="between">
          <Text variant="heading-s" as="h1">
            Products
          </Text>
          <NewProductButton />
        </Box>

        <ProductCatalogue />
      </Box>
    </AppShell>
  )
}

const NewProductButton = () => (
  <Box
    display="inline-flex"
    alignItems="center"
    columnGap="s"
    paddingHorizontal="l"
    paddingVertical="m"
    backgroundColor="background-inverse"
    borderRadius="full"
    cursor="pointer"
    role="button"
    aria-label="New Product"
  >
    <Plus size={12} strokeWidth={2.25} className="text-white" />
    <Text variant="body" color="inverse">
      New Product
    </Text>
  </Box>
)
