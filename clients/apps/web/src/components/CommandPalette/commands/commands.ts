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
}: ScopeContext): Command[] => {
  if (!router || !organization) return []

  return [
    {
      name: 'Go to Public Page',
      description: 'Navigate to the public page',
      action: () => {
        hideCommandPalette?.()

        router.push(`/${organization.name}`)
      },
    },
  ]
}
