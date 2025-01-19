import { AnimatePresence, motion } from 'framer-motion'
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
          <motion.div
            initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            animate={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            className="relative flex h-screen flex-col items-center md:w-full md:flex-row"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              hide()
            }}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className={twMerge(
                'dark:bg-polar-900 relative z-10 flex h-full max-h-full w-full flex-col overflow-hidden rounded-none bg-white shadow md:fixed md:bottom-4 md:right-4 md:top-4 md:h-auto md:w-[540px] dark:text-white',
                className,
              )}
              onClick={onInnerClick}
            >
              {modalContent}
            </motion.div>
          </motion.div>
        </div>
      </FocusLock>
    </React.Fragment>
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

export const CloseButton = (props: {
  className?: string
  hide: () => void
}) => {
  return (
    <button
      type="button"
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
        'dark:bg-polar-700 z-0 flex h-full w-full flex-col space-y-2 overflow-hidden rounded-2xl bg-gray-50 p-5 shadow-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
