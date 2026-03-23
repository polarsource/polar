'use client'

import { usePathname } from 'next/navigation'

const SandboxBanner = () => {
  const pathname = usePathname()

  if (['/', '/login'].includes(pathname)) {
    return null
  }

  return (
    <div className="sticky top-0 z-50 flex flex-row items-center justify-between bg-yellow-100 px-8 py-2 text-sm text-yellow-500 dark:bg-yellow-950">
      <div />
      <div className="hidden md:block">
        Changes you make here don&apos;t affect your live account • Payments are
        not processed
      </div>
      <div>
        <a href="https://polar.sh/start" className="font-bold hover:opacity-50">
          Exit sandbox
        </a>
      </div>
    </div>
  )
}

export default SandboxBanner
