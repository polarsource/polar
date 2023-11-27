import type { NextPage } from 'next'
import type { ReactElement, ReactNode } from 'react'

/*
 * Typescript types for NextJS Page.getLayout feature
 * https://nextjs.org/docs/basic-features/layouts#with-typescript
 */

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}
