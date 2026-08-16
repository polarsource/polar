'use client'

import { InlineModal, Text } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import { CookiePreferencesModal } from './CookiePreferencesModal'

export const CookiePreferencesButton = () => {
  const { isShown, show, hide } = useModal()

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="dark:hover:text-polar-100 flex flex-row items-center gap-x-1 text-black transition-colors hover:text-gray-500 dark:text-white"
      >
        <Text as="span" variant="heading-xxs" color="inherit">
          Cookie Preferences
        </Text>
      </button>
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={<CookiePreferencesModal hide={hide} />}
      />
    </>
  )
}
