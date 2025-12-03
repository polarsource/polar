'use client'

import { LocalStorageKey } from '@/hooks/upsell'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

const getIsDismissed = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    localStorage.getItem(LocalStorageKey.IOS_APP_BANNER_DISMISSED) === 'true'
  )
}

export const IOSAppBanner = () => {
  const [isDismissed, setIsDismissed] = useState(() => getIsDismissed())

  useEffect(() => {
    setIsDismissed(getIsDismissed())
  }, [])

  const dismiss = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.setItem(LocalStorageKey.IOS_APP_BANNER_DISMISSED, 'true')
    setIsDismissed(true)
  }, [])

  if (isDismissed) {
    return null
  }

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 pt-8 text-sm md:hidden">
      <button
        type="button"
        onClick={dismiss}
        className="dark:text-polar-500 dark:hover:text-polar-300 absolute top-4 right-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
        aria-label="Dismiss"
      >
        <CloseOutlined fontSize="small" />
      </button>

      <div className="flex flex-col gap-1">
        <span className="font-medium">Polar is now available on App Store</span>
        <span className="dark:text-polar-500 text-gray-500">
          Your dashboard, always in your pocket. Get push notifications for new
          sales, subscribers and more.
        </span>
      </div>
      <Link
        href="https://apps.apple.com/se/app/polar-monetize-your-software/id6746640471"
        target="_blank"
        className="self-start"
      >
        <Image
          src="/assets/app_store_badge.svg"
          alt="Download on the App Store"
          width={120}
          height={40}
          className="dark:brightness-0 dark:invert"
        />
      </Link>
    </div>
  )
}
