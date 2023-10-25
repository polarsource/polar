import React, { FunctionComponent, MouseEvent, useEffect } from 'react'
import ReactDOM from 'react-dom'
import FocusLock from 'react-focus-lock'
import { twMerge } from 'tailwind-merge'

export interface ModalProps {
  isShown: boolean
  hide: () => void
  modalContent: JSX.Element
  className?: string
}

export const Modal: FunctionComponent<ModalProps> = ({
  isShown,
  hide,
  modalContent,
  className,
}) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.keyCode === 27 && isShown) {
        hide()
      }
    }

    isShown
      ? (document.body.style.overflow = 'hidden')
      : (document.body.style.overflow = 'unset')

    document.addEventListener('keydown', onKeyDown, false)
    return () => {
      document.removeEventListener('keydown', onKeyDown, false)
    }
  }, [isShown, hide])

  const onInnerClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const modal = (
    <React.Fragment>
      <FocusLock>
        <div
          className="fixed bottom-0 left-0 right-0 top-0 z-50"
          aria-modal
          tabIndex={-1}
          role="dialog"
        >
          <div
            className="flex h-full w-full flex-col items-center  bg-black/50 py-2"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              hide()
            }}
          >
            <div className="flex-shrink-1 block h-[20%] w-2"></div>
            <div
              className={twMerge(
                'h-content dark:bg-polar-800 z-10 min-w-[800px] flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow',
                className,
              )}
              onClick={onInnerClick}
            >
              {modalContent}
            </div>
          </div>
        </div>
      </FocusLock>
    </React.Fragment>
  )

  return isShown ? ReactDOM.createPortal(modal, document.body) : null
}

export const ModalHeader = (props: {
  children: React.ReactElement
  className?: string
  hide: () => void
}) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 dark:text-polar-100 flex w-full items-center justify-between border-b px-5 py-3',
        props.className,
      )}
    >
      <div>{props.children}</div>
      <button
        className="dark:text-polar-100 dark:hover:text-polar-300 text-black hover:text-gray-800"
        onClick={() => props.hide()}
      >
        <XIcon />
      </button>
    </div>
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

export const ModalBox = ({
  children,
  className,
}: {
  children: React.ReactElement
  className?: string
}) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-700 z-0 flex h-full w-full flex-col space-y-2 overflow-hidden rounded-2xl bg-white p-5 shadow-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
