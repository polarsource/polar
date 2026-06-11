import { schemas } from '@polar-sh/client'
import { useCallback, useEffect, useRef } from 'react'
import { isNotifiable, markSeen } from './appealCaseUnread'

export const useUnreadTitleBadge = (
  organizationId: string,
  messages: schemas['SupportCaseMessage'][] | undefined,
) => {
  const count = (messages ?? []).filter(isNotifiable).length
  const seenCountRef = useRef(count)
  const latestCountRef = useRef(count)
  const baseTitleRef = useRef<string | null>(null)

  const clearBadge = useCallback(() => {
    if (baseTitleRef.current !== null) {
      document.title = baseTitleRef.current
      baseTitleRef.current = null
    }
  }, [])

  useEffect(() => {
    latestCountRef.current = count
    if (document.hidden) {
      const unread = count - seenCountRef.current
      if (unread > 0) {
        if (baseTitleRef.current === null) {
          baseTitleRef.current = document.title
        }
        document.title = `(${unread}) ${baseTitleRef.current}`
      }
    } else {
      seenCountRef.current = count
      // Viewing the thread also clears the persistent sidebar unread badge.
      markSeen(organizationId, count)
    }
  }, [count, organizationId])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        seenCountRef.current = latestCountRef.current
        markSeen(organizationId, latestCountRef.current)
        clearBadge()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [clearBadge, organizationId])

  useEffect(() => clearBadge, [clearBadge])
}
