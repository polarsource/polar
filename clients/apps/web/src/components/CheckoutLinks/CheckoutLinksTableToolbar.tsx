import ProductSelect from '@/components/Products/ProductSelect'
import AddOutlined from '@mui/icons-material/AddOutlined'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import { Button, Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface CheckoutLinksTableToolbarProps {
  organization: schemas['Organization']
  productIds: string[]
  query: string
  onProductIdsChange: (productIds: string[]) => void
  onQueryChange: (query: string) => void
  onCreate: () => void
}

export const CheckoutLinksTableToolbar = ({
  organization,
  productIds,
  query,
  onProductIdsChange,
  onQueryChange,
  onCreate,
}: CheckoutLinksTableToolbarProps) => (
  <Box
    flexDirection={{ base: 'column', md: 'row' }}
    alignItems={{ base: 'stretch', md: 'center' }}
    justifyContent="between"
    gap="l"
  >
    <Box flexDirection={{ base: 'column', sm: 'row' }} gap="m" flexGrow={1}>
      <Box width="100%" maxWidth={280}>
        <Input
          preSlot={<Search fontSize="small" />}
          placeholder="Search checkout links"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </Box>
      <Box width="100%" maxWidth={280}>
        <ProductSelect
          organization={organization}
          value={productIds}
          onChange={onProductIdsChange}
        />
      </Box>
    </Box>
    <Button onClick={onCreate} wrapperClassNames="gap-x-2">
      <AddOutlined fontSize="small" />
      New checkout link
    </Button>
  </Box>
)
