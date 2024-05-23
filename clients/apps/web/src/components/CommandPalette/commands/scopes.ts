import { Organization } from '@polar-sh/sdk'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { createAPICommands } from './APICommands'
import { Command, GLOBAL_COMMANDS } from './commands'
import { CommandPaletteContextValue } from './useCommands'

export type ScopeContext = {
  router: AppRouterInstance
  organization?: Organization
} & Pick<CommandPaletteContextValue, 'setScopeKeys' | 'hideCommandPalette'>

export enum ScopeType {
  Global,
  Isolated,
}

export interface Scope<T extends ScopeType = ScopeType> {
  name: string
  commands: Command[]
  type: T
}

export const API_SCOPES = [
  {
    name: 'api:donations',
    type: ScopeType.Isolated,
    commands: createAPICommands('donations'),
  },
  {
    name: 'api:subscriptions',
    type: ScopeType.Isolated,
    commands: createAPICommands('subscriptions'),
  },
  {
    name: 'api:benefits',
    type: ScopeType.Isolated,
    commands: createAPICommands('benefits'),
  },
  {
    name: 'api:issues',
    type: ScopeType.Isolated,
    commands: createAPICommands('issues'),
  },
  {
    name: 'api:newsletters',
    type: ScopeType.Isolated,
    commands: createAPICommands('newsletters'),
  },
  {
    name: 'api:users',
    type: ScopeType.Isolated,
    commands: createAPICommands('users'),
  },
  {
    name: 'api:accounts',
    type: ScopeType.Isolated,
    commands: createAPICommands('accounts'),
  },
  {
    name: 'api:webhooks',
    type: ScopeType.Isolated,
    commands: createAPICommands('webhooks'),
  },
  {
    name: 'api:OAuth',
    type: ScopeType.Isolated,
    commands: createAPICommands('oauth'),
  },
] as const

export const SCOPES = (context: ScopeContext) =>
  [
    {
      name: 'global',
      type: ScopeType.Global,
      commands: GLOBAL_COMMANDS(context),
    },
    ...API_SCOPES,
  ] as const

export type ScopeKey = ReturnType<typeof SCOPES>[number]['name']
