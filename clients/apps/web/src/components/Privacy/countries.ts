import { headers } from 'next/headers'

export const EU_COUNTRY_CODES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'GB',
  'GI',
  'IS',
  'LI',
  'NO',
  'CH',
  'ME',
  'MK',
  'RS',
  'TR',
  'AL',
  'BA',
  'XK',
  'AD',
  'BY',
  'MD',
  'MC',
  'RU',
  'UA',
  'VA',
  'AX',
  'FO',
  'GL',
  'SJ',
  'IM',
  'JE',
  'GG',
  'RS',
  'ME',
  'XK',
  'RS',
]

export function isEU() {
  const countryCode = headers().get('x-vercel-ip-country')

  if (countryCode && EU_COUNTRY_CODES.includes(countryCode)) {
    return true
  }

  return false
}
