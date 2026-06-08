import { schemas } from '@polar-sh/client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const SUPPORT_QUERY_PARAM = 'support'

const FEEDBACK_TYPES: schemas['FeedbackType'][] = [
  'question',
  'feedback',
  'bug',
]

const parseFeedbackType = (value: string | null): schemas['FeedbackType'] =>
  FEEDBACK_TYPES.includes(value as schemas['FeedbackType'])
    ? (value as schemas['FeedbackType'])
    : 'question'

export interface SupportModalState {
  isShown: boolean
  defaultType: schemas['FeedbackType']
  open: () => void
  hide: () => void
}

export const useSupportModal = (): SupportModalState => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const supportParam = searchParams.get(SUPPORT_QUERY_PARAM)
  const paramPresent = searchParams.has(SUPPORT_QUERY_PARAM)

  const [isShown, setIsShown] = useState(false)
  const [defaultType, setDefaultType] =
    useState<schemas['FeedbackType']>('question')
  const [handledParam, setHandledParam] = useState(false)

  if (paramPresent && !handledParam) {
    setIsShown(true)
    setDefaultType(parseFeedbackType(supportParam))
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

  const open = () => {
    setDefaultType('question')
    setIsShown(true)
  }

  const hide = () => setIsShown(false)

  return { isShown, defaultType, open, hide }
}
