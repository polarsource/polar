export type CustomerIpAddressResolver<TRequest> = (
  request: TRequest,
) => string | null | undefined | Promise<string | null | undefined>

const IPV4_OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`)

export const isValidIpAddress = (value: string): boolean =>
  IPV4.test(value) || (value.includes(':') && URL.canParse(`http://[${value}]`))

export const getIpAddressFromHeaders = (headers: Headers): string | undefined =>
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
