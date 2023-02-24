import { useState, useEffect } from 'react'

export const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false)

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  return hasHydrated
}
