import * as z from 'zod'

const IpAddress = z.union([z.ipv4(), z.ipv6()])

export const getCustomerIpAddress = (headers: Headers): string | undefined =>
  [
    headers.get('x-forwarded-for')?.split(',')[0],
    headers.get('x-real-ip'),
    headers.get('cf-connecting-ip'),
  ]
    .map((value) => value?.trim())
    .find((value) => IpAddress.safeParse(value).success)
