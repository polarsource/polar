import { schemas } from '@polar-sh/client'
import { Input } from '@polar-sh/orbit'
import { Switch } from '@polar-sh/orbit'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'

interface SeatConfiguration {
  configurable: boolean
  min: number
  max: number | null
}

// Seats can only be preconfigured when *every* selected product is seat-based.
// The allowed range is the intersection of each product's seat tier bounds.
const computeSeatConfiguration = (
  selectedProducts?: schemas['Product'][],
): SeatConfiguration => {
  if (!selectedProducts || selectedProducts.length === 0) {
    return { configurable: false, min: 1, max: null }
  }

  let min = 1
  let max: number | null = null
  for (const product of selectedProducts) {
    const seatPrice = product.prices.find(
      (price) => price.amount_type === 'seat_based',
    )
    if (!seatPrice || !('seat_tiers' in seatPrice) || !seatPrice.seat_tiers) {
      return { configurable: false, min: 1, max: null }
    }
    const tiers = [...(seatPrice.seat_tiers.tiers ?? [])].sort(
      (a, b) => a.min_seats - b.min_seats,
    )
    const tierMin = tiers[0]?.min_seats ?? 1
    const tierMax = tiers[tiers.length - 1]?.max_seats ?? null
    min = Math.max(min, tierMin)
    if (tierMax !== null) {
      max = max === null ? tierMax : Math.min(max, tierMax)
    }
  }

  return { configurable: true, min, max }
}

export const CheckoutLinkSeatsField = ({
  selectedProducts,
}: {
  selectedProducts?: schemas['Product'][]
}) => {
  const { control, setValue } = useFormContext<{ seats: number | null }>()

  const seatConfiguration = computeSeatConfiguration(selectedProducts)

  const seatRangeEmpty =
    seatConfiguration.configurable &&
    seatConfiguration.max !== null &&
    seatConfiguration.min > seatConfiguration.max

  // Drop a stale seat lock once the products are loaded and confirmed not to all
  // be seat-based (mirrors the backend auto-clear). Gated on loaded products so we
  // don't clobber an existing lock before the products query resolves.
  useEffect(() => {
    if (
      selectedProducts &&
      selectedProducts.length > 0 &&
      !seatConfiguration.configurable
    ) {
      setValue('seats', null)
    }
  }, [selectedProducts, seatConfiguration.configurable, setValue])

  if (!seatConfiguration.configurable) {
    return null
  }

  return (
    <FormField
      control={control}
      name="seats"
      rules={{
        validate: (value) => {
          if (value === null || value === undefined) return true
          if (seatRangeEmpty)
            return 'The selected products have incompatible seat ranges.'
          if (value < seatConfiguration.min)
            return `Must be at least ${seatConfiguration.min}.`
          if (seatConfiguration.max !== null && value > seatConfiguration.max)
            return `Must be at most ${seatConfiguration.max}.`
          return true
        },
      }}
      render={({ field }) => {
        const seatsLocked = field.value !== null && field.value !== undefined
        return (
          <FormItem>
            <div className="flex flex-row items-center justify-between space-y-0 space-x-2">
              <FormLabel htmlFor="seats-lock">Lock number of seats</FormLabel>
              <FormControl>
                <Switch
                  id="seats-lock"
                  checked={seatsLocked}
                  disabled={seatRangeEmpty}
                  onCheckedChange={(enabled) =>
                    field.onChange(enabled ? seatConfiguration.min : null)
                  }
                />
              </FormControl>
            </div>
            {seatsLocked && (
              <Input
                type="number"
                min={seatConfiguration.min}
                max={seatConfiguration.max ?? undefined}
                value={field.value ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  field.onChange(value === '' ? null : Number(value))
                }}
              />
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
