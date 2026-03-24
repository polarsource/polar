import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Button } from '@polar-sh/orbit'
import { motion } from 'framer-motion'
import React, {
  FunctionComponent,
  MouseEvent,
  useCallback,
  useEffect,
  type JSX,
} from 'react'
import ReactDOM from 'react-dom'
import FocusLock from 'react-focus-lock'
import { twMerge } from 'tailwind-merge'

export interface ModalProps {
  title: string
  isShown: boolean
  hide: () => void
  modalContent: JSX.Element
  className?: string
}

export const Modal: FunctionComponent<ModalProps> = ({
  title,
  isShown,
  hide,
  modalContent,
  className,
}) => {
  const ref = React.useRef<HTMLDivElement>(null)

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
    if (isShown) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [isShown, hide])

  const onInnerClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const modal = (
    <FocusLock>
      <div
        ref={ref}
        className="fixed top-0 right-0 bottom-0 left-0 z-50 overflow-hidden focus-within:outline-none dark:text-white"
        aria-modal
        tabIndex={-1}
        role="dialog"
        onKeyDown={onKeyDown}
      >
        <div
          className="flex h-full flex-col items-center bg-black/70 p-2 md:w-full"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            hide()
          }}
        >
          <div className="block h-20 w-2 lg:max-h-[10%] lg:grow-2" />
          <motion.div
            className={twMerge(
              'dark:bg-polar-950 dark:border-polar-800 relative z-10 flex max-h-full w-full flex-col gap-y-1 overflow-x-hidden overflow-y-auto rounded-3xl bg-gray-100 p-1 shadow-sm lg:w-[800px] lg:max-w-full dark:border',
              className,
            )}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.1, ease: 'easeInOut' }}
            onClick={onInnerClick}
          >
            <div className="flex flex-row items-center justify-between pt-1 pr-1 pb-0 pl-4 text-sm">
              <span className="dark:text-polar-500 text-gray-500">{title}</span>
              <Button
                variant="ghost"
                size="sm"
                className="dark:text-polar-500 dark:hover:text-polar-400 size-8 rounded-full text-gray-500 hover:text-gray-600"
                onClick={hide}
              >
                <CloseOutlined fontSize="inherit" />
              </Button>
            </div>
            <div className="dark:bg-polar-900 flex flex-col overflow-y-auto rounded-[20px] bg-white">
              {modalContent}
            </div>
          </motion.div>
        </div>
      </div>
    </FocusLock>
  )

  return isShown ? ReactDOM.createPortal(modal, document.body) : null
}
