'use client'

import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { X } from 'lucide-react'
import { motion } from 'motion/react'
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import ReactDOM from 'react-dom'
import FocusLock from 'react-focus-lock'
import { PortalText } from './PortalPrimitives'

// Stripe injects its 3D Secure challenge iframe at the document root, so focus
// must be allowed to leave the dialog for iframes.
const allowFocusInIframes = (activeElement: HTMLElement) =>
  activeElement.tagName !== 'IFRAME'

export interface PortalDialogProps {
  isShown: boolean
  hide: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}

export const PortalDialog = ({
  isShown,
  hide,
  title,
  description,
  children,
  actions,
}: PortalDialogProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isShown) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isShown])

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        ref.current?.contains(event.target as Node)
      ) {
        event.stopPropagation()
        hide()
      }
    },
    [hide],
  )

  if (!isShown || typeof document === 'undefined') {
    return null
  }

  return ReactDOM.createPortal(
    <FocusLock whiteList={allowFocusInIframes}>
      <div
        ref={ref}
        role="dialog"
        aria-modal
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 focus:outline-none sm:items-center sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault()
            hide()
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col"
        >
          <Box
            flexDirection="column"
            maxHeight="100%"
            overflow="hidden"
            backgroundColor="background-primary"
            borderTopLeftRadius="l"
            borderTopRightRadius="l"
            borderBottomLeftRadius={{ base: 'none', sm: 'l' }}
            borderBottomRightRadius={{ base: 'none', sm: 'l' }}
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            boxShadow="xl"
          >
            <Box
              justifyContent="between"
              alignItems="start"
              columnGap="l"
              paddingTop="xl"
              paddingHorizontal="xl"
            >
              <Box flexDirection="column" rowGap="xs" minWidth={0}>
                <Text variant="heading-xxs" as="h2">
                  {title}
                </Text>
                {description ? (
                  <PortalText tone="secondary" className="text-sm">
                    {description}
                  </PortalText>
                ) : null}
              </Box>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={hide}
              >
                <X className="h-4 w-4" />
              </Button>
            </Box>
            {children ? (
              <Box
                flexDirection="column"
                rowGap="l"
                overflowY="auto"
                paddingHorizontal="xl"
                paddingTop="xl"
                paddingBottom={actions ? 'none' : 'xl'}
              >
                {children}
              </Box>
            ) : null}
            {actions ? (
              <Box
                justifyContent="end"
                alignItems="center"
                columnGap="s"
                rowGap="s"
                flexWrap="wrap"
                padding="xl"
              >
                {actions}
              </Box>
            ) : null}
          </Box>
        </motion.div>
      </div>
    </FocusLock>,
    document.body,
  )
}

export const PortalConfirmDialog = ({
  isShown,
  hide,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
}: {
  isShown: boolean
  hide: () => void
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  onConfirm: () => unknown
}) => {
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
      hide()
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <PortalDialog
      isShown={isShown}
      hide={isConfirming ? () => {} : hide}
      title={title}
      description={description}
      actions={
        <>
          <Button variant="ghost" onClick={hide} disabled={isConfirming}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            loading={isConfirming}
          >
            {confirmText}
          </Button>
        </>
      }
    />
  )
}

export const PortalDrawerHeader = ({
  title,
  hide,
}: {
  title: ReactNode
  hide: () => void
}) => (
  <Box
    position="sticky"
    top={0}
    zIndex={1}
    justifyContent="between"
    alignItems="center"
    columnGap="l"
    paddingHorizontal="2xl"
    paddingVertical="l"
    backgroundColor="background-primary"
  >
    <PortalText tone="secondary" className="text-sm">
      {title}
    </PortalText>
    <Button variant="ghost" size="icon" aria-label="Close" onClick={hide}>
      <X className="h-4 w-4" />
    </Button>
  </Box>
)
