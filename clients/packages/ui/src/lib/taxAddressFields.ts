export type TaxAddressField = 'country' | 'state' | 'postal_code' | 'city'

// Mirrors server/polar/kit/address.py: these fields feed tax calculation, so
// the backend refuses to change them on an existing order.
const STATE_TAX_COUNTRIES = ['US', 'CA', 'BR', 'IN']
const POSTAL_CODE_TAX_COUNTRIES = ['US', 'ES', 'PT']
const CITY_TAX_COUNTRIES = ['BR']

export const getTaxAddressFields = (
  country?: string | null,
): TaxAddressField[] => {
  const fields: TaxAddressField[] = ['country']
  if (!country) {
    return fields
  }
  if (STATE_TAX_COUNTRIES.includes(country)) {
    fields.push('state')
  }
  if (POSTAL_CODE_TAX_COUNTRIES.includes(country)) {
    fields.push('postal_code')
  }
  if (CITY_TAX_COUNTRIES.includes(country)) {
    fields.push('city')
  }
  return fields
}
