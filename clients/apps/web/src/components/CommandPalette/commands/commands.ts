import { Organization } from '@polar-sh/sdk'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
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
    ...(organization
      ? organizationSpecificCommands(router, organization, hideCommandPalette)
      : []),
    ...API_SCOPES.map((scope) => ({
      name: `${scope.name.replace('api:', '')} API`,
      description: `View API documentation for ${scope.name.replace('api:', '')}`,
      action: () => {
        setScopeKeys(['global', scope.name])
      },
    })),
  ]
}

const organizationSpecificCommands = (
  router: AppRouterInstance,
  organization: Organization,
  hideCommandPalette: () => void,
) => {
  return [
    {
      name: 'Go to Public Page',
      description: 'Navigate to the public page',
      action: () => {
        hideCommandPalette()

        router.push(`/${organization.name}`)
      },
    },
  ]
}
