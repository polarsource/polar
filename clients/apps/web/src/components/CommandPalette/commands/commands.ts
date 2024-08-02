import { Organization } from '@polar-sh/sdk'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { Params } from 'next/dist/shared/lib/router/utils/route-matcher'
import { ReadonlyURLSearchParams } from 'next/navigation'
import { OpenAPIV3_1 } from 'openapi-types'
import { API_SCOPES, ScopeContext } from './scopes'

export type CommandContext = {
  pathname: string
  params: Params
  searchParams: ReadonlyURLSearchParams
  router: AppRouterInstance
  hidePalette: () => void
  organization?: Organization
}

export enum CommandType {
  Action,
  Shortcut,
  Documentation,
  API,
}

export interface BaseCommand {
  id: string
  name: string
  description: string
  action: (context: CommandContext) => void
}

export interface ActionCommand extends BaseCommand {
  type: CommandType.Action
}

export interface ShortcutCommand extends BaseCommand {
  type: CommandType.Shortcut
}

export interface DocumentationCommand extends BaseCommand {
  type: CommandType.Documentation
}

export interface APICommand extends BaseCommand {
  type: CommandType.API
  operation: OpenAPIV3_1.OperationObject
  method: OpenAPIV3_1.HttpMethods
  endpointPath: string
}

export type Command =
  | ActionCommand
  | ShortcutCommand
  | DocumentationCommand
  | APICommand

export const GLOBAL_COMMANDS = ({
  organization,
  setScopeKeys,
}: ScopeContext): Command[] => {
  const orgSpecificCommands = organization ? organizationSpecificCommands : []

  const apiCommands: ShortcutCommand[] = API_SCOPES.map((scope) => ({
    id: `scope-${scope.name}-${scope.type}`,
    name: `${scope.name.replace('api:', '')} API`,
    description: `View API documentation for ${scope.name.replace('api:', '')}`,
    type: CommandType.Shortcut,
    action: () => {
      setScopeKeys(['global', scope.name])
    },
  }))

  return [...orgSpecificCommands, ...apiCommands]
}

const organizationSpecificCommands: Command[] = [
  {
    id: 'go-to-public-page',
    name: 'Go to Public Page',
    description: 'Navigate to the public page',
    type: CommandType.Shortcut,
    action: ({ hidePalette, router, organization }) => {
      if (organization) {
        hidePalette()

        router.push(`/${organization.slug}`)
      }
    },
  },
  {
    id: 'write-new-post',
    name: 'Write New Post',
    description: 'Navigate to the post editor',
    type: CommandType.Shortcut,
    action: ({ hidePalette, router, organization }) => {
      if (organization) {
        hidePalette()

        router.push(`/dashboard/${organization.slug}/posts/new`)
      }
    },
  },
]
