'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

interface NavigationHistoryContextValue {
  currentURL: string
  previousURL: string | null
  withPotentialPreviousParams: (pathPrefix: string) => string
}

const NavigationHistoryContext = createContext<NavigationHistoryContextValue>({
  currentURL: '',
  previousURL: null,
  withPotentialPreviousParams: (path) => path,
})

export const useNavigationHistory = () => useContext(NavigationHistoryContext)

export const NavigationHistoryProvider = ({ children }: PropsWithChildren) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [previousURL, setPreviousURL] = useState<string | null>(null)
  const currentURLRef = useRef<string | null>(null)

  const currentURL = useMemo(() => {
    const searchString = searchParams.toString()
    return searchString ? `${pathname}?${searchString}` : pathname
  }, [pathname, searchParams])

  useEffect(() => {
    if (currentURLRef.current !== currentURL) {
      setPreviousURL(currentURLRef.current)
      currentURLRef.current = currentURL
    }
  }, [currentURL])

  const withPotentialPreviousParams = useCallback(
    (pathPrefix: string) => {
      if (previousURL?.startsWith(pathPrefix)) {
        const queryIndex = previousURL.indexOf('?')
        if (queryIndex !== -1) {
          return `${pathPrefix}${previousURL.slice(queryIndex)}`
        }
      }
      return pathPrefix
    },
    [previousURL],
  )

  return (
    <NavigationHistoryContext.Provider
      value={{ currentURL, previousURL, withPotentialPreviousParams }}
    >
      {children}
    </NavigationHistoryContext.Provider>
  )
}
