export const POLAR_REQUEST_PATH_HEADER = 'x-polar-request-path'

export const getLoginPath = (returnTo?: string | null): string =>
  returnTo ? `/auth?${new URLSearchParams({ return_to: returnTo })}` : '/auth'
