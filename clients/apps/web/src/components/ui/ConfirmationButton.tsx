'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import React, { useEffect, useState } from 'react'

interface ConfirmationButtonProps {
  onConfirm: () => void
  warningMessage: string
  buttonText: string
  confirmText: string
  disabled?: boolean
  loading?: boolean
  variant?:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'ghost'
    | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  requireConfirmation?: boolean
  destructive?: boolean
}

export default function ConfirmationButton({
  onConfirm,
  warningMessage,
  buttonText,
  confirmText,
  disabled = false,
  loading = false,
  variant = 'default',
  size = 'default',
  className = '',
  requireConfirmation = true,
  destructive = false,
}: ConfirmationButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showConfirmation) {
        handleCancel()
      }
    }

    if (showConfirmation) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showConfirmation])

  const handleInitialClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (requireConfirmation && !disabled) {
      setShowConfirmation(true)
    } else {
      onConfirm()
    }
  }

  const handleConfirm = () => {
    onConfirm()
    setShowConfirmation(false)
  }

  const handleCancel = () => {
    setShowConfirmation(false)
  }

  const getConfirmationStyles = () => {
    if (destructive) {
      return {
        container:
          'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/30',
        icon: 'text-red-500 dark:text-red-400',
        message: 'text-red-800 dark:text-red-200',
        confirmButton: 'destructive' as const,
      }
    }
    return {
      container:
        'border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30',
      icon: 'text-blue-500 dark:text-blue-400',
      message: 'text-blue-800 dark:text-blue-200',
      confirmButton: 'default' as const,
    }
  }

  const styles = getConfirmationStyles()

  if (!showConfirmation) {
    return (
      <Button
        type="button"
        onClick={handleInitialClick}
        disabled={disabled}
        loading={loading}
        variant={variant}
        size={size}
        className={className}
      >
        {buttonText}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Warning Message */}
      <div
        className={`flex items-center gap-2 text-sm ${styles.message} font-medium sm:flex-1`}
      >
        <div className={styles.icon}>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <span>{warningMessage}</span>
      </div>

      {/* Confirmation Buttons */}
      <div className="flex gap-2 sm:shrink-0">
        <Button
          type="button"
          onClick={handleConfirm}
          loading={loading}
          size={size}
          variant={destructive ? 'destructive' : 'default'}
          autoFocus
          className="flex-1 sm:flex-initial"
        >
          {confirmText}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          disabled={loading}
          size={size}
          className="flex-1 sm:flex-initial"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
