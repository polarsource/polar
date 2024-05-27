'use client'

import SwaggerParser from '@apidevtools/swagger-parser'
import openapiSchema from '@polar-sh/sdk/openapi'
import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

const swaggerParser = new SwaggerParser()

export interface DocumentationContextValue {
  schema?: typeof openapiSchema
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
  const [schema, setSchema] = useState<typeof openapiSchema>()
  const [intersectingToCEntries, setIntersectingToCEntries] = useState<
    string[]
  >([])

  useEffect(() => {
    // @ts-ignore
    swaggerParser.dereference(openapiSchema).then(setSchema)
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
