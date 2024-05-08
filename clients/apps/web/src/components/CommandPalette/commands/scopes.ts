import { Organization } from '@polar-sh/sdk'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { createAPICommands } from './APICommands'
import { Command, GLOBAL_COMMANDS } from './commands'

export interface ScopeContext {
  router: AppRouterInstance
  organization: Organization
  scopeKey: ScopeKey
  setScopeKeys: (
    scopeKeys: ((scopeKeys: ScopeKey[]) => ScopeKey[]) | ScopeKey[],
  ) => void
  hideCommandPalette: () => void
}

export enum ScopeType {
  Global,
  Isolated,
}

export interface Scope<T extends ScopeType = ScopeType> {
  name: string
  commands: Command[]
  type: T
}

const API_SCOPES = [
  {
    name: 'api:issues',
    type: ScopeType.Isolated,
    commands: createAPICommands('issues'),
  },
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
    name: 'api:posts',
    type: ScopeType.Isolated,
    commands: createAPICommands('posts'),
  },
  {
    name: 'api:webhooks',
    type: ScopeType.Isolated,
    commands: createAPICommands('webhooks'),
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
