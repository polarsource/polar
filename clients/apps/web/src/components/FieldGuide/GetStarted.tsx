'use client'

import { useGetStarted } from '@/components/Auth/GetStartedButton'

/**
 * The manual's way in: the landing page's sign-up flow, set as a bracketed mono command that inverts to a solid Snow
 * block on hover.
 */
export function GetStarted() {
  const { open, modal } = useGetStarted()
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="group cursor-pointer border-0 bg-transparent px-1 py-1 font-mono text-[13px] leading-none whitespace-pre text-[#d8d8d8] transition-colors hover:bg-[#d8d8d8] hover:text-[#141414]"
      >
        <span className="text-[#7b7b7b] transition-colors group-hover:text-[#141414]">
          [
        </span>{' '}
        Get started{' '}
        <span className="text-[#7b7b7b] transition-colors group-hover:text-[#141414]">
          ]
        </span>
      </button>
      {modal}
    </>
  )
}
