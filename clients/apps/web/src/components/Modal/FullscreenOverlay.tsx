'use client'

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
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
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
            className="dark:bg-polar-950 fixed inset-0 bg-gray-50"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              hide()
            }}
          >
            <div
              className={twMerge('fixed inset-0 z-10 overflow-auto', className)}
              onClick={onInnerClick}
            >
              {modalContent}
            </div>
          </div>
        </div>
      </FocusLock>
    </React.Fragment>
  )

  if (typeof document === 'undefined') {
    return null
  }

  return isShown ? ReactDOM.createPortal(modal, document.body) : null
}
