import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export type ProductIcon = React.ComponentType<{ size?: number }>

export type ProductCardProps = {
  name: string
  type: string
  icon: ProductIcon
}

export const ProductCard = ({ name, type, icon: Icon }: ProductCardProps) => (
  <Box
    display="flex"
    flexDirection="column"
    justifyContent="between"
    rowGap="xl"
    padding="2xl"
    backgroundColor="background-card"
    aspectRatio="1 / 1"
    cursor="pointer"
  >
    <Box color="text-primary" display="inline-flex">
      <Icon size={28} />
    </Box>
    <Box display="flex" flexDirection="column" rowGap="s">
      <Text variant="heading-s" color="inherit">
        {name}
      </Text>
      <Text variant="heading-s" color="muted">
        {type}
      </Text>
    </Box>
  </Box>
)
