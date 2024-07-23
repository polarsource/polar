import { resolveEndpointMetadata } from '@/components/Documentation/openapi'
import openapiSchema from '@/openapi.json'
import SwaggerParser from '@apidevtools/swagger-parser'
import { Organization } from '@polar-sh/sdk'
import lunr from 'lunr'
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import { OpenAPIV3_1 } from 'openapi-types'
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import lunrSearchIndex from '../index/searchIndex.json'
import lunrSearchMetadata from '../index/searchMetadata.json'
import {
  APICommand,
  Command,
  CommandType,
  DocumentationCommand,
} from './commands'
import { SCOPES, Scope, ScopeKey, ScopeType } from './scopes'
import { useScopes } from './useScopes'

const apiParser = new SwaggerParser()

// @ts-ignore
const searchMetadataLookup = new Map([
  ...lunrSearchMetadata.openapi.map((m) => [m.id, m]),
  ...lunrSearchMetadata.docs.map((m) => [m.id, m]),
])

export interface CommandPaletteContextValue {
  apiSchema?: OpenAPIV3_1.Document
  scopes: ReturnType<typeof SCOPES>
  scopeKey: ScopeKey
  scope?: Scope
  scopeKeys: ScopeKey[]
  setScopeKeys: (
    scopeKeys: ((scopeKeys: ScopeKey[]) => ScopeKey[]) | ScopeKey[],
  ) => void
  commands: Command[]
  selectedCommand?: Command
  setSelectedCommand: (command: Command) => void
  input: string
  setInput: (input: string) => void
  hideCommandPalette: () => void
}

const defaultCommandPaletteContextValue: CommandPaletteContextValue = {
  apiSchema: undefined,
  scopes: [] as any,
  scopeKey: 'global',
  scope: { name: 'global', commands: [], type: ScopeType.Global },
  scopeKeys: [],
  setScopeKeys: () => [],
  commands: [],
  selectedCommand: {
    id: '',
    name: '',
    description: '',
    type: CommandType.Action,
    action: () => {},
  },
  setSelectedCommand: () => {},
  input: '',
  setInput: () => {},
  hideCommandPalette: () => {},
}

const CommandPaletteContext = createContext(defaultCommandPaletteContextValue)

interface CommandPaletteContextProviderProps {
  organization?: Organization
  hideCommandPalette: () => void
}

export const CommandPaletteContextProvider = ({
  children,
  organization,
  hideCommandPalette,
}: PropsWithChildren<CommandPaletteContextProviderProps>) => {
  const params = useParams()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [apiSchema, setApiSchema] = useState<OpenAPIV3_1.Document>()
  const [scopeKeys, setScopeKeys] = useState<ScopeKey[]>(['global'])
  const [selectedCommand, setSelectedCommand] = useState<Command>()
  const [input, setInput] = useState('')

  const searchIndex: lunr.Index = useMemo(() => {
    return lunr.Index.load(lunrSearchIndex)
  }, [])

  const scopeKey = useMemo(() => scopeKeys[scopeKeys.length - 1], [scopeKeys])

  const scopes = useScopes(
    {
      setScopeKeys,
      hideCommandPalette,
    },
    organization,
  )

  const scope = useMemo(
    () => scopes.find((scope) => scope.name === scopeKey),
    [scopes, scopeKey],
  )

  useEffect(() => {
    // @ts-ignore
    apiParser.dereference(openapiSchema).then(setApiSchema)
  }, [])

  // Filter out commands based on input
  const commands = useMemo(() => {
    const searchResults =
      scope?.type === ScopeType.Global && input.length > 0
        ? searchIndex.query((q) =>
            q.term(input.trim().split(/\s+/), {
              wildcard: lunr.Query.wildcard.TRAILING,
            }),
          )
        : []

    const searchCommands = searchResults.map<DocumentationCommand | APICommand>(
      // @ts-ignore
      (result) => {
        const isAPIEntry = result.ref.includes('/v1/')

        if (!apiSchema) {
          throw new Error('API Schema not loaded')
        }

        if (isAPIEntry) {
          const document = searchMetadataLookup.get(result.ref) as {
            path: string
            method: string
          }
          const { operation, method, apiEndpointPath } =
            resolveEndpointMetadata(
              [
                ...document.path.split('/').filter((part) => !!part),
                document.method,
              ],
              apiSchema,
            )

          return {
            id: `${operation.operationId}-${method ?? 'unknown'}-${apiEndpointPath}`,
            name: operation.summary ?? '',
            description: 'Explore API Endpoint',
            type: CommandType.API,
            operation: operation,
            method: method,
            endpointPath: apiEndpointPath,
            action: () => {
              router.push(result.ref)

              hideCommandPalette()
            },
          }
        } else {
          return {
            id: `doc-${result.ref}`,
            // @ts-ignore
            name: searchMetadataLookup.get(result.ref).title ?? '',
            description: 'Open in Polar Documentation',
            type: CommandType.Documentation,
            action: () => {
              router.push(result.ref)

              hideCommandPalette()
            },
          }
        }
      },
    )

    const scopeCommands =
      scope?.commands.filter(
        (command) =>
          command.name.toLowerCase().includes(input.toLowerCase()) ||
          command.description.toLowerCase().includes(input.toLowerCase()),
      ) ?? []

    return [...searchCommands, ...scopeCommands]
  }, [scope, input, searchIndex, router, hideCommandPalette, apiSchema])

  useEffect(() => {
    setSelectedCommand(commands[0])
  }, [commands])

  useEffect(() => {
    setInput('')
  }, [scopeKeys])

  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (!selectedCommand) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()

        const currentIndex = commands.indexOf(selectedCommand)
        if (currentIndex < commands.length - 1) {
          setSelectedCommand(commands[currentIndex + 1])
        } else {
          setSelectedCommand(commands[0])
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()

        const currentIndex = commands.indexOf(selectedCommand)
        if (currentIndex > 0) {
          setSelectedCommand(commands[currentIndex - 1])
        } else {
          setSelectedCommand(commands[commands.length - 1])
        }
      }

      if (e.key === 'Enter' && selectedCommand.action) {
        e.preventDefault()
        e.stopPropagation()

        selectedCommand.action({
          hidePalette: hideCommandPalette,
          router,
          organization,
          params,
          searchParams,
          pathname,
        })
      }

      if (
        e.key === 'Backspace' &&
        input.length === 0 &&
        scope?.type === ScopeType.Isolated
      ) {
        e.preventDefault()
        e.stopPropagation()

        setScopeKeys((prev) => prev.slice(0, -1))
      }
    }

    document.addEventListener('keydown', handleArrowKeys)

    return () => {
      document.removeEventListener('keydown', handleArrowKeys)
    }
  }, [
    commands,
    selectedCommand,
    hideCommandPalette,
    input,
    scope,
    scopes,
    scopeKey,
    setScopeKeys,
    router,
    organization,
    params,
    searchParams,
    pathname,
  ])

  return (
    <CommandPaletteContext.Provider
      value={{
        scopes,
        scope,
        scopeKeys,
        setScopeKeys,
        scopeKey,
        commands,
        selectedCommand,
        setSelectedCommand,
        input,
        setInput,
        hideCommandPalette,
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  )
}

export const useCommands = () => useContext(CommandPaletteContext)
