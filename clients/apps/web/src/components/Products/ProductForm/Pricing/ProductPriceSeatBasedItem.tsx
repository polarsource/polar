import React from 'react'
import { ProductPriceUnitBasedItem } from './ProductPriceUnitBasedItem'

const SEAT_NOUNS = { unitLabel: 'seat', unitLabelPlural: 'seats' }

export interface ProductPriceSeatBasedItemProps {
  index: number
  currency: string
}

export const ProductPriceSeatBasedItem: React.FC<
  ProductPriceSeatBasedItemProps
> = ({ index, currency }) => (
  <ProductPriceUnitBasedItem
    index={index}
    currency={currency}
    nouns={SEAT_NOUNS}
  />
)
