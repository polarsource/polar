'use client'

import { Modal } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import { useEffect, useRef, useState } from 'react'

interface BackupCodesModalProps {
  isShown: boolean
  hide: () => void
  codes: string[]
}

export default function BackupCodesModal({
  isShown,
  hide,
  codes,
}: BackupCodesModalProps) {
  const codesText = codes.join('\n')

  const [isCopied, setIsCopied] = useState(false)
  const copyResetTimeout = useRef<number | null>(null)

  const handleCopy = () => {
    navigator.clipboard.writeText(codesText)
    setIsCopied(true)
    copyResetTimeout.current = window.setTimeout(() => setIsCopied(false), 2000)
  }

  // Clear timeout if the component unmounts while the "Copied!" state is active
  useEffect(() => {
    return () => {
      if (copyResetTimeout.current) {
        clearTimeout(copyResetTimeout.current)
      }
    }
  }, [])

  const modalContent = (
    <div className="p-8">
      <p className="dark:text-polar-400 mb-4 max-w-md text-sm text-gray-600">
        You&rsquo;ll only see these backup codes once, so save them somewhere
        secure. Each code lets you sign in one time if you lose access to your
        authenticator app.
      </p>

      <div className="relative">
        <pre className="dark:bg-polar-800 rounded-lg bg-gray-100 p-4 font-mono text-sm break-all whitespace-pre-wrap">
          {codesText}
        </pre>
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2"
          onClick={handleCopy}
        >
          {isCopied ? 'Copied!' : 'Copy All'}
        </Button>
      </div>

      <div className="mt-4 text-center">
        <Button onClick={hide}>I&apos;ve saved my codes</Button>
      </div>
    </div>
  )

  return (
    <Modal
      title="Your Backup Codes"
      isShown={isShown}
      hide={hide}
      className="lg:max-w-lg"
      modalContent={modalContent}
    />
  )
}
