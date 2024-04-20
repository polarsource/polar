import { usePathname } from 'next/navigation'
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

export const ContextView = () => {
  const { content } = useContextView()

  if (!content) return null

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 flex w-[420px] flex-col border-l border-gray-100 bg-white p-12">
      {content}
    </div>
  )
}

interface ContextViewContextValue {
  content: JSX.Element | null
  setContent: (content: JSX.Element | null) => void
}

const ContextViewContext = createContext<ContextViewContextValue>({
  content: null,
  setContent: (content: JSX.Element | null) => {},
})

export const ContextViewProvider = ({ children }: PropsWithChildren) => {
  const [content, setContent] = useState<JSX.Element | null>(null)

  const pathname = usePathname()

  useEffect(() => {
    setContent(null)
  }, [pathname])

  return (
    <ContextViewContext.Provider value={{ content, setContent }}>
      {children}
    </ContextViewContext.Provider>
  )
}

export const useContextView = () => {
  return useContext(ContextViewContext)
}
