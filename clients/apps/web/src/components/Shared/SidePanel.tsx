import { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const PANEL_CLASS =
  'dark:bg-polar-900 dark:border-polar-800 flex-col overflow-y-auto bg-white lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-xs'

// The panel beside a page's main card. One that was opened covers a small
// screen. One that is always there stays off it, and the page shows what it
// holds some other way.
export const SidePanel = ({
  persistent = false,
  children,
}: {
  persistent?: boolean
  children: ReactNode
}) => (
  <div
    className={twMerge(
      PANEL_CLASS,
      persistent ? 'hidden lg:flex' : 'fixed inset-0 z-50 flex',
    )}
  >
    {children}
  </div>
)
