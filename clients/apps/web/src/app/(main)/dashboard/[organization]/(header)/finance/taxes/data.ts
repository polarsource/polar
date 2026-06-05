import { differenceInCalendarDays } from 'date-fns'

export interface TaxJurisdiction {
  id: string
  country: string
  countryCode: string
  region: string
  taxType: 'VAT' | 'Sales Tax' | 'GST'
  rate: number
  // All amounts in minor units (cents). Polar remits 100% on the merchant's
  // behalf, so there is no "collected but not remitted" state to track.
  taxableAmount: number
  taxRemitted: number
  orderCount: number
}

export interface TaxSummary {
  jurisdictions: TaxJurisdiction[]
  totalTaxableAmount: number
  totalRemitted: number
  totalOrders: number
  jurisdictionCount: number
}

// Base daily figures (cents) per jurisdiction. The mock scales these by the
// number of days in the selected period so the breakdown reacts to the range.
const BASE_JURISDICTIONS: Array<
  Omit<TaxJurisdiction, 'taxableAmount' | 'taxRemitted' | 'orderCount'> & {
    dailyTaxable: number
    dailyOrders: number
  }
> = [
  {
    id: 'gb',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'England',
    taxType: 'VAT',
    rate: 0.2,
    dailyTaxable: 412_00,
    dailyOrders: 18,
  },
  {
    id: 'de',
    country: 'Germany',
    countryCode: 'DE',
    region: 'Bavaria',
    taxType: 'VAT',
    rate: 0.19,
    dailyTaxable: 388_00,
    dailyOrders: 16,
  },
  {
    id: 'fr',
    country: 'France',
    countryCode: 'FR',
    region: 'Île-de-France',
    taxType: 'VAT',
    rate: 0.2,
    dailyTaxable: 274_00,
    dailyOrders: 11,
  },
  {
    id: 'us-ca',
    country: 'United States',
    countryCode: 'US',
    region: 'California',
    taxType: 'Sales Tax',
    rate: 0.0725,
    dailyTaxable: 521_00,
    dailyOrders: 24,
  },
  {
    id: 'us-ny',
    country: 'United States',
    countryCode: 'US',
    region: 'New York',
    taxType: 'Sales Tax',
    rate: 0.08875,
    dailyTaxable: 333_00,
    dailyOrders: 14,
  },
  {
    id: 'au',
    country: 'Australia',
    countryCode: 'AU',
    region: 'New South Wales',
    taxType: 'GST',
    rate: 0.1,
    dailyTaxable: 196_00,
    dailyOrders: 9,
  },
  {
    id: 'ca',
    country: 'Canada',
    countryCode: 'CA',
    region: 'Ontario',
    taxType: 'GST',
    rate: 0.13,
    dailyTaxable: 158_00,
    dailyOrders: 7,
  },
]

/**
 * Builds a mocked tax remittance breakdown for the given period. Every cent of
 * tax is presented as fully remitted by Polar on the merchant's behalf. Figures
 * scale with the number of days in the range so the table responds to the
 * selected period. Replace with a real API call once the endpoint exists.
 */
export const buildTaxSummary = (from: Date, to: Date): TaxSummary => {
  const days = Math.max(1, differenceInCalendarDays(to, from) + 1)

  const jurisdictions: TaxJurisdiction[] = BASE_JURISDICTIONS.map((base) => {
    const taxableAmount = base.dailyTaxable * days
    return {
      id: base.id,
      country: base.country,
      countryCode: base.countryCode,
      region: base.region,
      taxType: base.taxType,
      rate: base.rate,
      taxableAmount,
      taxRemitted: Math.round(taxableAmount * base.rate),
      orderCount: base.dailyOrders * days,
    }
  }).sort((a, b) => b.taxRemitted - a.taxRemitted)

  return {
    jurisdictions,
    totalTaxableAmount: jurisdictions.reduce(
      (sum, j) => sum + j.taxableAmount,
      0,
    ),
    totalRemitted: jurisdictions.reduce((sum, j) => sum + j.taxRemitted, 0),
    totalOrders: jurisdictions.reduce((sum, j) => sum + j.orderCount, 0),
    jurisdictionCount: jurisdictions.length,
  }
}
