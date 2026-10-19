'use client'

import { useGetStarted } from '@/components/Auth/GetStartedButton'

/** The manual's way in: the landing page's sign-up flow, set in the manual's mono on a solid Snow ground. */
export function GetStarted() {
  const { open, modal } = useGetStarted()
  return (
    <>
      <button
        type="button"
        onClick={open}
        className="cursor-pointer border-0 bg-[#d8d8d8] px-3 py-2 font-mono text-[13px] leading-none text-[#141414] transition-colors hover:bg-white"
      >
        Get started →
      </button>
      {modal}
    </>
  )
}
