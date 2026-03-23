'use client'

import { usePathname } from 'next/navigation'

const SandboxBanner = () => {
  const pathname = usePathname()

  if (['/', '/login', '/onboarding/sandbox'].includes(pathname)) {
    return null
  }

  return (
    <div className="sticky top-0 z-50 flex flex-row items-center justify-between border-b border-gray-200 bg-yellow-50 px-11 py-2 text-sm text-yellow-500 dark:border-b-0 dark:bg-yellow-950">
      <div />
      <div className="hidden md:block">
        Changes you make here don&apos;t affect your live account · Payments are
        not processed
      </div>
      <div>
        <a
          href="https://polar.sh/start"
          className="font-medium transition-colors hover:text-yellow-600 dark:hover:text-yellow-400"
        >
          Exit sandbox
        </a>
      </div>
    </div>
  )
}

export default SandboxBanner
