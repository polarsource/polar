import { Toast, ToastType } from '@/components/Shared/Toast'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

const AUTO_DISMISS_DURATION = 2000
const BOTTOM_OFFSET = 30

interface ToastOptions {
  persistent?: boolean
  /** Delay in ms before showing the toast */
  delay?: number
}

interface ToastState {
  id: number
  message: string
  type: ToastType
  persistent: boolean
}

interface ToastContextValue {
  showInfo: (message: string, options?: ToastOptions) => void
  showSuccess: (message: string, options?: ToastOptions) => void
  showError: (message: string, options?: ToastOptions) => void
  showWarning: (message: string, options?: ToastOptions) => void
  dismiss: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idCounter = useRef(0)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current)
      delayTimeoutRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setVisible(false)
    setTimeout(() => {
      setToast(null)
    }, 200)
  }, [clearTimer])

  const showToast = useCallback(
    (message: string, type: ToastType, options?: ToastOptions) => {
      clearTimer()

      const persistent = options?.persistent ?? false
      const delay = options?.delay ?? 0
      const id = ++idCounter.current

      const doShow = () => {
        setToast({ id, message, type, persistent })
        setVisible(true)

        if (!persistent) {
          timeoutRef.current = setTimeout(() => {
            dismiss()
          }, AUTO_DISMISS_DURATION)
        }
      }

      if (delay > 0) {
        delayTimeoutRef.current = setTimeout(doShow, delay)
      } else {
        doShow()
      }
    },
    [clearTimer, dismiss],
  )

  const showInfo = useCallback(
    (message: string, options?: ToastOptions) => {
      showToast(message, 'info', options)
    },
    [showToast],
  )

  const showSuccess = useCallback(
    (message: string, options?: ToastOptions) => {
      showToast(message, 'success', options)
    },
    [showToast],
  )

  const showError = useCallback(
    (message: string, options?: ToastOptions) => {
      showToast(message, 'error', options)
    },
    [showToast],
  )

  const showWarning = useCallback(
    (message: string, options?: ToastOptions) => {
      showToast(message, 'warning', options)
    },
    [showToast],
  )

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  const contextValue: ToastContextValue = {
    showInfo,
    showSuccess,
    showError,
    showWarning,
    dismiss,
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          persistent={toast.persistent}
          visible={visible}
          onDismiss={dismiss}
          bottomOffset={BOTTOM_OFFSET}
        />
      )}
    </ToastContext.Provider>
  )
}
