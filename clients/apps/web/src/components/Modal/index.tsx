import React, { FunctionComponent, useEffect } from 'react'
import ReactDOM from 'react-dom'
import FocusLock from 'react-focus-lock'

export interface ModalProps {
  isShown: boolean
  hide: () => void
  modalContent: JSX.Element
}

export const Modal: FunctionComponent<ModalProps> = ({
  isShown,
  hide,
  modalContent,
}) => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.keyCode === 27 && isShown) {
      hide()
    }
  }

  useEffect(() => {
    isShown
      ? (document.body.style.overflow = 'hidden')
      : (document.body.style.overflow = 'unset')
    document.addEventListener('keydown', onKeyDown, false)
    return () => {
      document.removeEventListener('keydown', onKeyDown, false)
    }
  }, [isShown])

  const modal = (
    <React.Fragment>
      <div
        onClick={hide}
        className="absolute top-0 bottom-0 left-0 right-0 z-10 bg-black opacity-50"
      ></div>
      <FocusLock>
        <div
          className="fixed top-0 bottom-0 left-0 right-0 z-10"
          aria-modal
          tabIndex={-1}
          role="dialog"
        >
          <div className="flex h-full w-full items-center justify-center">
            <div className="fixed min-w-[600px] overflow-hidden rounded-xl bg-white shadow">
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
  hide: () => void
}) => {
  return (
    <div className="flex w-full items-center justify-between border-b px-4 py-2">
      <div>{props.children}</div>
      <button
        className="text-black hover:text-gray-800"
        onClick={() => props.hide()}
      >
        <XIcon />
      </button>
    </div>
  )
}

export const ModalBody = (props: { children: React.ReactElement }) => {
  return <div className="w-full px-4 py-2">{props.children}</div>
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
