import { ReadonlyURLSearchParams } from 'next/navigation'

/** Appends the listed search params to `href` so list state survives navigation. */
export const withKeptParams = (
  searchParams: ReadonlyURLSearchParams,
  keys: readonly string[],
) => {
  const kept = new URLSearchParams(
    [...searchParams.entries()].filter(([key]) => keys.includes(key)),
  )
  const qs = kept.toString()
  return (href: string) => (qs ? `${href}?${qs}` : href)
}
