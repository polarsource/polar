import * as z from 'zod'

export type CustomerIpAddressResolver<TRequest> = (
  request: TRequest,
) => string | null | undefined | Promise<string | null | undefined>

const IpAddress = z.union([z.ipv4(), z.ipv6()])

const isValidIpAddress = (value: string): boolean =>
  IpAddress.safeParse(value).success

const getIpAddressFromHeaders = (headers: Headers): string | undefined =>
  [
    headers.get('x-forwarded-for')?.split(',')[0],
    headers.get('x-real-ip'),
    headers.get('cf-connecting-ip'),
  ]
    .map((value) => value?.trim())
    .find((value) => value !== undefined && isValidIpAddress(value))

export const resolveCustomerIpAddress = async <TRequest>(
  request: TRequest,
  headers: Headers,
  resolver: CustomerIpAddressResolver<TRequest> | false | undefined,
): Promise<string | undefined> => {
  if (resolver === false) {
    return undefined
  }
  if (!resolver) {
    return getIpAddressFromHeaders(headers)
  }
  const ipAddress = (await resolver(request))?.trim()
  return ipAddress && isValidIpAddress(ipAddress) ? ipAddress : undefined
}
