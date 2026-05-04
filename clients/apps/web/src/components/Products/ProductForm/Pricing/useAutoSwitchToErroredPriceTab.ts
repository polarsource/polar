import { useEffect, useState } from 'react'
import { type FieldPath, useFormContext, useFormState } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import { hasPriceCurrency } from './utils'

export const useAutoSwitchToErroredPriceTab = (
  setSelectedCurrency: (currency: string) => void,
) => {
  const [autoSwitched, setAutoSwitched] = useState(false)
  const { control, setFocus, getValues } = useFormContext<ProductFormType>()
  const { errors } = useFormState({ control, name: 'prices' })

  const priceErrors = Array.isArray(errors.prices) ? errors.prices : []
  const erroredIndex = priceErrors.findIndex(Boolean)
  const erroredField = Object.keys(priceErrors[erroredIndex] ?? {})[0]

  if (erroredIndex >= 0 && !autoSwitched) {
    setAutoSwitched(true)
    const price = getValues('prices')?.[erroredIndex]
    if (price && hasPriceCurrency(price))
      setSelectedCurrency(price.price_currency)
  } else if (erroredIndex < 0 && autoSwitched) {
    setAutoSwitched(false)
  }

  useEffect(() => {
    if (erroredIndex >= 0 && erroredField) {
      setFocus(
        `prices.${erroredIndex}.${erroredField}` as FieldPath<ProductFormType>,
      )
    }
  }, [erroredIndex, erroredField, setFocus])
}
