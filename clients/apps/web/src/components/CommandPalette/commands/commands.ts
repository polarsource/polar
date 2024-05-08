import { API_SCOPES, ScopeContext } from './scopes'

export interface Command {
  name: string
  description: string
  action?: () => void
  keyboardShortcut?: (e: KeyboardEvent) => void
}

export const GLOBAL_COMMANDS = ({
  router,
  organization,
  setScopeKeys,
  hideCommandPalette,
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
    ...API_SCOPES.map((scope) => ({
      name: `${scope.name.replace('api:', '')} API`,
      description: `View API documentation for ${scope.name.replace('api:', '')}`,
      action: () => {
        setScopeKeys(['global', scope.name])
      },
    })),
  ]
}
