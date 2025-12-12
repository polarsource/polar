import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react'

type DeepLinkHandler = (url: URL) => boolean | void

interface DeepLinkContextValue {
  registerHandler: (path: string, handler: DeepLinkHandler) => () => void
}

const DeepLinkContext = createContext<DeepLinkContextValue>({
  registerHandler: () => () => {},
})

export const useDeepLinks = () => useContext(DeepLinkContext)

export default function DeepLinkProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const handlersRef = useRef<Map<string, DeepLinkHandler>>(new Map())
  const initialUrlHandled = useRef(false)

  const registerHandler = useCallback(
    (path: string, handler: DeepLinkHandler) => {
      handlersRef.current.set(path, handler)
      return () => {
        handlersRef.current.delete(path)
      }
    },
    [],
  )

  const handleDeepLink = useCallback((event: { url: string }) => {
    try {
      const url = new URL(event.url)
      const path = url.hostname

      const handler = handlersRef.current.get(path)
      if (handler) {
        const handled = handler(url)
        if (handled !== false) return
      }
    } catch (error) {
      console.error('Error handling deep link:', error)
    }
  }, [])

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink)

    if (!initialUrlHandled.current) {
      Linking.getInitialURL().then((url) => {
        if (url && !initialUrlHandled.current) {
          initialUrlHandled.current = true
          handleDeepLink({ url })
        }
      })
    }

    return () => subscription.remove()
  }, [handleDeepLink])

  return (
    <DeepLinkContext.Provider value={{ registerHandler }}>
      {children}
    </DeepLinkContext.Provider>
  )
}
