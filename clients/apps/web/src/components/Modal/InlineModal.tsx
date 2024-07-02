import React, {
  FunctionComponent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import ReactDOM from 'react-dom'
import FocusLock from 'react-focus-lock'
import { twMerge } from 'tailwind-merge'

export interface InlineModalProps {
  isShown: boolean
  hide: () => void
  modalContent: JSX.Element
  className?: string
}

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
    isShown
      ? (document.body.style.overflow = 'hidden')
      : (document.body.style.overflow = 'unset')
  }, [isShown])

  const onInnerClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const modal = (
    <React.Fragment>
      <FocusLock>
        <div
          ref={ref}
          className="fixed inset-0 z-50 overflow-hidden focus-within:outline-none"
          aria-modal
          tabIndex={-1}
          role="dialog"
          onKeyDown={onKeyDown}
        >
          <div
            className="flex h-screen flex-col items-center bg-black/50 md:w-full md:flex-row md:items-start md:justify-end md:p-4"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              hide()
            }}
          >
            <div
              className={twMerge(
                'dark:bg-polar-900 rounded-4xl relative z-10 flex h-full max-h-full w-full flex-col overflow-hidden bg-white shadow md:w-[540px]',
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

export const CloseButton = (props: {
  className?: string
  hide: () => void
}) => {
  return (
    <button
      className={twMerge(
        'dark:text-polar-100 dark:hover:text-polar-300 text-black hover:text-gray-800',
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
