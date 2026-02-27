'use client'

import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import { CookiePreferencesModal } from './CookiePreferencesModal'

export const CookiePreferencesButton = () => {
  const { isShown, show, hide } = useModal()

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="dark:text-white dark:hover:text-polar-100 flex flex-row items-center gap-x-1 text-black transition-colors hover:text-gray-500"
      >
        Cookie Preferences
      </button>
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={<CookiePreferencesModal hide={hide} />}
      />
    </>
  )
}
