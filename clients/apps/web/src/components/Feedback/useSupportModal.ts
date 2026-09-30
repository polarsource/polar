import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const SUPPORT_QUERY_PARAM = 'support'

export interface SupportModalState {
  isShown: boolean
  open: () => void
  hide: () => void
}

export const useSupportModal = (): SupportModalState => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const paramPresent = searchParams.has(SUPPORT_QUERY_PARAM)

  const [isShown, setIsShown] = useState(false)
  const [handledParam, setHandledParam] = useState(false)

  if (paramPresent && !handledParam) {
    setIsShown(true)
    setHandledParam(true)
  } else if (!paramPresent && handledParam) {
    setHandledParam(false)
  }

  useEffect(() => {
    if (!paramPresent) {
      return
    }

    const params = new URLSearchParams(searchParams)
    params.delete(SUPPORT_QUERY_PARAM)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [paramPresent, searchParams, pathname, router])

  const open = () => setIsShown(true)

  const hide = () => setIsShown(false)

  return { isShown, open, hide }
}
