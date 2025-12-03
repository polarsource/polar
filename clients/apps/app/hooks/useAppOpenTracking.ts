import { useEffect, useRef } from 'react'
import { useStoreReview } from './useStoreReview'

export function useAppOpenTracking() {
  const { incrementAppOpenCount } = useStoreReview()
  const hasIncrementedRef = useRef(false)

  useEffect(() => {
    if (!hasIncrementedRef.current) {
      incrementAppOpenCount()
      hasIncrementedRef.current = true
    }
  }, [incrementAppOpenCount])
}
