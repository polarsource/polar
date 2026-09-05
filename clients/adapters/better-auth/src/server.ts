import type { AuthContext, BetterAuthPlugin } from 'better-auth'
import {
  onAfterUserCreate,
  onBeforeUserCreate,
  onBeforeUserDelete,
  onUserDelete,
  onUserUpdate,
} from './hooks/customer'
import { installOrganizationHooks } from './organization/hooks'
import { createOrganizationLifecycleHooks } from './organization/lifecycle'
import type { PolarEndpoints, PolarOptions } from './types'

interface PolarBetterAuthPlugin {
  id: 'polar'
  endpoints: PolarEndpoints
  hooks: ReturnType<typeof createOrganizationLifecycleHooks>
  init: (ctx: AuthContext) => {
    options: {
      databaseHooks: {
        user: {
          create: {
            before: ReturnType<typeof onBeforeUserCreate>
            after: ReturnType<typeof onAfterUserCreate>
          }
          update: {
            after: ReturnType<typeof onUserUpdate>
          }
          delete: {
            before: ReturnType<typeof onBeforeUserDelete>
            after: ReturnType<typeof onUserDelete>
          }
        }
      }
    }
  }
}

export const polar = <O extends PolarOptions>(
  options: O,
): PolarBetterAuthPlugin => {
  const plugins = options.use.reduce<PolarEndpoints>((endpoints, use) => {
    Object.assign(endpoints, use(options.client, options))
    return endpoints
  }, {} as PolarEndpoints)

  return {
    id: 'polar',
    endpoints: plugins,
    hooks: createOrganizationLifecycleHooks(options),
    init(ctx) {
      installOrganizationHooks(ctx, options)

      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                before: onBeforeUserCreate(options),
                after: onAfterUserCreate(options),
              },
              update: {
                after: onUserUpdate(options, ctx),
              },
              delete: {
                before: onBeforeUserDelete(options, ctx),
                after: onUserDelete(options),
              },
            },
          },
        },
      }
    },
  } satisfies BetterAuthPlugin
}
