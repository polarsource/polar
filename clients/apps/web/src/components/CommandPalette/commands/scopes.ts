import { createAPICommands } from '../useAPICommands'
import { Command, GLOBAL_COMMANDS } from './commands'

export enum ScopeType {
  Global,
  Isolated,
}

export interface Scope<T extends ScopeType = ScopeType> {
  name: string
  commands: Command[]
  type: T
}

const API_SCOPES: Scope<ScopeType.Isolated>[] = [
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
]

export const SCOPES: Scope[] = [
  {
    name: 'global',
    type: ScopeType.Global,
    commands: GLOBAL_COMMANDS,
  },
  ...API_SCOPES,
]
