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

export type CustomerIpAddressOption<TRequest> =
  | false
  | ((
      request: TRequest,
    ) => string | null | undefined | Promise<string | null | undefined>)

export const resolveCustomerIpAddress = async <TRequest>(
  request: TRequest,
  option: CustomerIpAddressOption<TRequest> | undefined,
  getDefault: () => string | null | undefined,
): Promise<string | undefined> =>
  option === false
    ? undefined
    : ((await (option ? option(request) : getDefault())) ?? undefined)
