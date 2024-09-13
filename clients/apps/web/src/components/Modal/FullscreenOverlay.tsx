import { CloseOutlined } from '@mui/icons-material'
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

export interface FullscreenOverlayProps {
  isShown: boolean
  hide: () => void
  modalContent: React.ReactNode
  className?: string
}

export const FullscreenOverlay: FunctionComponent<FullscreenOverlayProps> = ({
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
            className="fixed inset-0 bg-black/50"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              hide()
            }}
          >
            <div
              className={twMerge('fixed inset-0 z-10', className)}
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

export const OverlayHeader = (props: {
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
      <CloseOutlined />
    </button>
  )
}
