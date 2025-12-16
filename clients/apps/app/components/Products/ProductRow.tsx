import { Box } from '@/components/Shared/Box'
import { Image } from '@/components/Shared/Image/Image'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { StyleProp, TextStyle } from 'react-native'
import { Pill } from '../Shared/Pill'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'
import { ProductPriceLabel } from './ProductPriceLabel'

export interface ProductRowProps {
  product: schemas['Product']
  style?: StyleProp<TextStyle>
}

export const ProductRow = ({ product, style }: ProductRowProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/catalogue/products/${product.id}`}
      style={[
        {
          padding: theme.spacing['spacing-16'],
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: theme.borderRadii['border-radius-12'],
          gap: theme.spacing['spacing-12'],
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
      asChild
    >
      <Touchable>
        <Box
          width={48}
          height={48}
          borderRadius="border-radius-8"
          overflow="hidden"
        >
          {product?.medias?.[0]?.public_url ? (
            <Image
              source={{ uri: product?.medias?.[0]?.public_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <Box
              width="100%"
              height="100%"
              justifyContent="center"
              alignItems="center"
              borderColor="border"
              borderWidth={1}
              borderRadius="border-radius-8"
            >
              <MaterialIcons
                name="texture"
                size={24}
                color={theme.colors.subtext}
              />
            </Box>
          )}
        </Box>
        <Box flex={1} flexDirection="column" gap="spacing-4">
          <Box
            flexDirection="row"
            gap="spacing-4"
            justifyContent="space-between"
          >
            <Text
              variant="bodyMedium"
              style={{ flexShrink: 1 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {product.name}
            </Text>
            {product.is_archived ? <Pill color="red">Archived</Pill> : null}
          </Box>
          <ProductPriceLabel product={product} />
        </Box>
      </Touchable>
    </Link>
  )
}
