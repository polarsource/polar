'use client'

import { CONFIG } from '@/utils/config'
import SwaggerParser from '@apidevtools/swagger-parser'
import openapiSchema from '@polar-sh/sdk/openapi'
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

const swaggerParser = new SwaggerParser()

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
    const fetchSchema = async () => {
      let schema = openapiSchema as any
      // Fetch the schema from the server in development
      if (CONFIG.ENVIRONMENT === 'development') {
        const schemaResponse = await fetch(`${CONFIG.BASE_URL}/openapi.json`)
        schema = await schemaResponse.json()
      }
      swaggerParser.dereference(schema).then((parsedSchema) => {
        setSchema(parsedSchema as OpenAPIV3_1.Document)
      })
    }
    fetchSchema()
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
