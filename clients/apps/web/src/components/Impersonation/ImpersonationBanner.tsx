'use client'

import { useEffect, useState } from 'react'

const ImpersonationBanner = () => {
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    const checkCookie = () => {
      const cookies = document.cookie.split(';')
      const hasImpersonationCookie = cookies.some((cookie) =>
        cookie.trim().startsWith('polar_is_impersonating='),
      )
      setIsImpersonating(hasImpersonationCookie)
    }

    checkCookie()
    const interval = setInterval(checkCookie, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!isImpersonating) {
    return null
  }

  return (
    <div className="sticky top-0 z-50 flex flex-row items-center justify-between bg-red-100 px-8 py-2 text-sm text-red-600 dark:bg-red-950">
      <div className="flex-[1_0_0]"></div>
      <div className="hidden flex-[1_0_0] font-medium md:block">
        You are currently impersonating another user
      </div>
      <div className="flex-[1_0_0] text-right">
        <a
          href={`${process.env.NEXT_PUBLIC_BACKOFFICE_URL}/impersonation/end`}
          className="font-bold hover:opacity-50"
        >
          Exit impersonation
        </a>
      </div>
    </div>
  )
}

export default ImpersonationBanner
