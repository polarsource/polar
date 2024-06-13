'use client'

import { OpenAPIV3_1 } from 'openapi-types'
import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import { fetchSchema } from './openapi'

export interface DocumentationContextValue {
  schema?: OpenAPIV3_1.Document
  intersectingToCEntries: string[]
  setIntersectingToCEntries: Dispatch<SetStateAction<string[]>>
}

export const defaultDocumentationContextValue: DocumentationContextValue = {
  schema: undefined,
  intersectingToCEntries: [],
  setIntersectingToCEntries: () => {},
}

export const DocumentationContext = createContext(
  defaultDocumentationContextValue,
)

export const DocumentationProvider = ({ children }: PropsWithChildren) => {
  const [schema, setSchema] = useState<OpenAPIV3_1.Document>()
  const [intersectingToCEntries, setIntersectingToCEntries] = useState<
    string[]
  >([])

  useEffect(() => {
    fetchSchema().then(setSchema)
  }, [])

  return (
    <DocumentationContext.Provider
      value={{
        intersectingToCEntries,
        setIntersectingToCEntries,
        schema,
      }}
    >
      {children}
    </DocumentationContext.Provider>
  )
}

export const useDocumentationContext = () => useContext(DocumentationContext)
