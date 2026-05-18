import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Plus } from 'lucide-react'
import { AppShell } from '../_components/AppShell'
import { ProductCatalogue } from '../_components/ProductCatalogue'

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
    color="text-inverse"
    borderRadius="full"
    cursor="pointer"
    role="button"
    aria-label="New Product"
  >
    <Plus size={12} strokeWidth={2.25} />
    <Text variant="body" color="inherit">
      New Product
    </Text>
  </Box>
)
