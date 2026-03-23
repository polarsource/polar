import type { toast as toastFunction } from '@/components/Toast/use-toast'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useCallback } from 'react'

export const useSafeCopy = (toast: typeof toastFunction) => {
  return useCallback(
    async (text: string) => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise<void>(async (resolve) => {
        try {
          await navigator.clipboard.writeText(text)
          resolve()
        } catch {
          // Safe fallback for browsers like Safari blocking copy command if run inside an async promise
          // Basically, we show a toast with a button to copy the content, so the operation is sync user-triggered
          toast({
            title: 'Click below to copy content',
            description: (
              <div className="my-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(text)
                    resolve()
                  }}
                  size="sm"
                >
                  Copy
                </Button>
              </div>
            ),
          })
        }
      })
    },
    [toast],
  )
}
