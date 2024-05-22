import { Organization } from '@polar-sh/sdk'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { Params } from 'next/dist/shared/lib/router/utils/route-matcher'
import { ReadonlyURLSearchParams } from 'next/navigation'
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

  const apiCommands: APICommand[] = API_SCOPES.map((scope) => ({
    name: `${scope.name.replace('api:', '')} API`,
    description: `View API documentation for ${scope.name.replace('api:', '')}`,
    type: CommandType.API,
    action: () => {
      setScopeKeys(['global', scope.name])
    },
  }))

  return [...orgSpecificCommands, ...apiCommands]
}

const organizationSpecificCommands: Command[] = [
  {
    name: 'Go to Public Page',
    description: 'Navigate to the public page',
    type: CommandType.Shortcut,
    action: ({ hidePalette, router, organization }) => {
      if (organization) {
        hidePalette()

        router.push(`/${organization.name}`)
      }
    },
  },
]
