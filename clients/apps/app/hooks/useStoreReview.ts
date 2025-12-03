import * as StoreReview from 'expo-store-review'
import { useCallback, useEffect, useState } from 'react'
import {
  getStorageItemAsync,
  setStorageItemAsync,
  useStorageState,
} from './storage'

const STORAGE_KEYS = {
  HAS_RATED: 'rating_prompt_has_rated',
  APP_OPEN_COUNT: 'rating_prompt_app_open_count',
  LAST_SHOWN: 'rating_prompt_last_shown',
  ASK_COUNT: 'rating_prompt_ask_count',
} as const

const MINIMUM_APP_OPENS = 5
const MAX_PROMPTS_PER_YEAR = 3
const MINIMUM_DAYS_BETWEEN_PROMPTS = 120

export interface UseStoreReviewReturn {
  requestReview: () => Promise<void>
  shouldShow: (hasOrders: boolean) => boolean
  isLoading: boolean
  incrementAppOpenCount: () => Promise<void>
}

export function useStoreReview(): UseStoreReviewReturn {
  const [[isLoadingHasRated, hasRated]] = useStorageState(
    STORAGE_KEYS.HAS_RATED,
  )
  const [[isLoadingAppOpenCount, appOpenCount]] = useStorageState(
    STORAGE_KEYS.APP_OPEN_COUNT,
  )
  const [[isLoadingLastShown, lastShown]] = useStorageState(
    STORAGE_KEYS.LAST_SHOWN,
  )
  const [[isLoadingAskCount, askCount]] = useStorageState(
    STORAGE_KEYS.ASK_COUNT,
  )

  const [isAvailable, setIsAvailable] = useState(false)

  const isLoading =
    isLoadingHasRated ||
    isLoadingAppOpenCount ||
    isLoadingLastShown ||
    isLoadingAskCount

  useEffect(() => {
    StoreReview.isAvailableAsync().then(setIsAvailable)
  }, [])

  const shouldShow = useCallback(
    (hasOrders: boolean) => {
      if (isLoading || !isAvailable) {
        return false
      }

      const openCount = appOpenCount ? parseInt(appOpenCount, 10) : 0

      // We only want to show the rating if you have orders and have opened
      // the app 5 times from a cold state.
      const meetsAppOpenRequirement = openCount >= MINIMUM_APP_OPENS
      const meetsOrderRequirement = hasOrders
      const meetsRequirements = meetsAppOpenRequirement && meetsOrderRequirement

      // Apple guidelines requires us to only ask for rating 3 times per year,
      // with at least 3 months apart between each request.
      const hasNotRated = hasRated !== 'true'
      const count = askCount ? parseInt(askCount, 10) : 0
      const underMaxPrompts = count < MAX_PROMPTS_PER_YEAR
      let meetsTimingRequirement = true

      if (lastShown) {
        const lastShownDate = new Date(parseInt(lastShown, 10))
        const daysSinceLastShown = Math.floor(
          (Date.now() - lastShownDate.getTime()) / (1000 * 60 * 60 * 24),
        )
        meetsTimingRequirement =
          daysSinceLastShown >= MINIMUM_DAYS_BETWEEN_PROMPTS
      }

      const meetsMandatoryAppleRequirements =
        hasNotRated && underMaxPrompts && meetsTimingRequirement

      return meetsRequirements && meetsMandatoryAppleRequirements
    },
    [isLoading, isAvailable, hasRated, appOpenCount, askCount, lastShown],
  )

  const requestReview = useCallback(async () => {
    if (!isAvailable) {
      return
    }

    if (hasRated === 'true') {
      return
    }

    const count = askCount ? parseInt(askCount, 10) : 0
    if (count >= MAX_PROMPTS_PER_YEAR) {
      return
    }

    if (lastShown) {
      const lastShownDate = new Date(parseInt(lastShown, 10))
      const daysSinceLastShown = Math.floor(
        (Date.now() - lastShownDate.getTime()) / (1000 * 60 * 60 * 24),
      )

      if (daysSinceLastShown < MINIMUM_DAYS_BETWEEN_PROMPTS) {
        return
      }
    }

    await StoreReview.requestReview()
    await setStorageItemAsync(STORAGE_KEYS.LAST_SHOWN, Date.now().toString())
    await setStorageItemAsync(STORAGE_KEYS.ASK_COUNT, (count + 1).toString())
    await setStorageItemAsync(STORAGE_KEYS.HAS_RATED, 'true')
  }, [isAvailable, hasRated, askCount, lastShown])

  const incrementAppOpenCount = useCallback(async () => {
    const storedValue = await getStorageItemAsync(STORAGE_KEYS.APP_OPEN_COUNT)
    const currentCount = storedValue ? parseInt(storedValue, 10) : 0
    const newCount = currentCount + 1

    await setStorageItemAsync(STORAGE_KEYS.APP_OPEN_COUNT, newCount.toString())
  }, [])

  return {
    requestReview,
    shouldShow,
    isLoading,
    incrementAppOpenCount,
  }
}
