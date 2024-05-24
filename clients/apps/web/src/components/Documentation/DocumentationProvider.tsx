'use client'

import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from 'react'

export interface DocumentationContextValue {
  intersectingToCEntries: string[]
  setIntersectingToCEntries: Dispatch<SetStateAction<string[]>>
}

export const defaultDocumentationContextValue: DocumentationContextValue = {
  intersectingToCEntries: [],
  setIntersectingToCEntries: () => {},
}

export const DocumentationContext = createContext(
  defaultDocumentationContextValue,
)

export const DocumentationProvider = ({ children }: PropsWithChildren) => {
  const [intersectingToCEntries, setIntersectingToCEntries] = useState<
    string[]
  >([])

  return (
    <DocumentationContext.Provider
      value={{
        intersectingToCEntries,
        setIntersectingToCEntries,
      }}
    >
      {children}
    </DocumentationContext.Provider>
  )
}

export const useDocumentationContext = () => useContext(DocumentationContext)
