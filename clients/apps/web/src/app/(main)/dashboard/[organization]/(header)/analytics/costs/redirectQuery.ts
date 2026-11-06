// Next passes repeated params as arrays; the explorer's array params
// (parseAsArrayOf) read them back comma-separated.
export const toRedirectValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join(',') : value
