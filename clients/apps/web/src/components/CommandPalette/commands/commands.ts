import { ScopeContext } from './scopes'

export interface Command {
  name: string
  description: string
  action?: () => void
  keyboardShortcut?: (e: KeyboardEvent) => void
}

export const GLOBAL_COMMANDS = ({
  router,
  organization,
  hideCommandPalette,
  setScopeKeys,
}: ScopeContext): Command[] => {
  return [
    {
      name: 'Go to Public Page',
      description: 'Navigate to the public page',
      action: () => {
        hideCommandPalette()

        router.push(`/${organization.name}`)
      },
    },
    {
      name: 'Issues API',
      description: 'View API documentation for Issues',
      action: () => {
        setScopeKeys(['global', 'api:issues'])
      },
    },
  ]
}
