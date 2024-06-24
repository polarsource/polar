'use client'

import {
  ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import React, { useEffect, useState } from 'react'

const LIMIT = 3 * 10

interface PurchasesQueryParameters {
  page: number
  limit: number
  query?: string
  inactive?: boolean
}

export const PurchasesQueryParametersContext = React.createContext<
  [
    PurchasesQueryParameters,
    React.Dispatch<React.SetStateAction<PurchasesQueryParameters>>,
  ]
>([{ page: 1, limit: LIMIT, inactive: false }, () => {}])

export const PurchasesQueryParametersContextProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams() as ReadonlyURLSearchParams
  const [parameters, setParameters] = useState<PurchasesQueryParameters>({
    page: searchParams.get('page')
      ? Number.parseInt(searchParams.get('page') || '1', 10)
      : 1,
    limit: LIMIT,
    query: searchParams.get('query') || undefined,
    inactive: searchParams.get('inactive') === 'true',
  })

  useEffect(() => {
    const updatedSearchParams = new URLSearchParams(
      Object.keys(parameters).reduce((acc, key) => {
        if (parameters[key as keyof PurchasesQueryParameters] === undefined) {
          return acc
        }
        return {
          ...acc,
          [key]: `${parameters[key as keyof PurchasesQueryParameters]}`,
        }
      }, {}),
    )
    router.replace(`${pathname}?${updatedSearchParams.toString()}`)
  }, [parameters, router, pathname])

  return (
    <PurchasesQueryParametersContext.Provider
      value={[parameters, setParameters]}
    >
      {children}
    </PurchasesQueryParametersContext.Provider>
  )
}
