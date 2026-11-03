'use client'

import { AnimatePresence, motion } from 'motion/react'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  type JSX,
} from 'react'
import ReactDOM from 'react-dom'
import FocusLock from 'react-focus-lock'
import { twMerge } from 'tailwind-merge'

export interface InlineModalProps {
  isShown: boolean
  hide: () => void
  modalContent: JSX.Element | null
  className?: string
}

// Let focus escape into iframes rendered outside the modal (e.g. Stripe's 3D
// Secure challenge, which Stripe injects at the document root). Without this the
// focus lock yanks focus back into the modal, making the challenge's inputs
// uninteractable. Returning false tells the lock to ignore the element; every
// other element stays trapped as usual.
const allowFocusInIframes = (activeElement: HTMLElement) =>
  activeElement.tagName !== 'IFRAME'

export const InlineModal: FunctionComponent<InlineModalProps> = ({
  isShown,
  hide,
  modalContent,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null)

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const contains = ref.current?.contains(event.target as Node)

      if (event.keyCode === 27 && isShown && contains) {
        hide()
      }
    },
    [hide, isShown],
  )

  useEffect(() => {
    // oxlint-disable-next-line typescript/no-unused-expressions
    isShown
      ? (document.body.style.overflow = 'hidden')
      : (document.body.style.overflow = 'unset')
  }, [isShown])

  const modal = (
    <FocusLock whiteList={allowFocusInIframes}>
      <div
        ref={ref}
        className="fixed inset-0 z-50 overflow-hidden focus-within:outline-none"
        aria-modal
        tabIndex={-1}
        role="dialog"
        onKeyDown={onKeyDown}
      >
        <motion.div
          initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
          animate={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
          className="relative flex h-screen flex-col items-center md:w-full md:flex-row"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) {
              return
            }
            e.preventDefault()
            hide()
          }}
        >
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: '100%',
              opacity: 0,
              transition: { duration: 0.2, ease: [0.3, 0, 1, 1] },
            }}
            // Mirrors the `slow` duration + `decelerate` easing tokens; a tween
            // settles without the overshoot an underdamped spring produces.
            transition={{ duration: 0.32, ease: [0, 0, 0, 1] }}
            className={twMerge(
              'dark:bg-polar-900 relative z-10 flex h-full max-h-full w-full flex-col overflow-y-auto bg-white shadow-sm md:fixed md:top-0 md:right-0 md:bottom-0 md:h-auto md:w-[540px] dark:text-white',
              className,
            )}
          >
            {modalContent}
          </motion.div>
        </motion.div>
      </div>
    </FocusLock>
  )

  if (typeof document === 'undefined') {
    return null
  }

  return ReactDOM.createPortal(
    <AnimatePresence>{isShown && modal}</AnimatePresence>,
    document.body,
  )
}

export const InlineModalHeader = (props: {
  children: React.ReactElement
  className?: string
  hide: () => void
}) => {
  return (
    <div
      className={twMerge(
        'flex w-full items-center justify-between px-8 py-6',
        props.className,
      )}
    >
      <div className="text-lg">{props.children}</div>
      <CloseButton hide={props.hide} />
    </div>
  )
}

const CloseButton = (props: { className?: string; hide: () => void }) => {
  return (
    <button
      type="button"
      className={twMerge(
        'dark:text-polar-400 cursor-pointer text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white',
        props.className,
      )}
      onClick={() => props.hide()}
      tabIndex={-1}
    >
      <XIcon />
    </button>
  )
}

const XIcon = () => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 18L18 6M6 6L18 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
