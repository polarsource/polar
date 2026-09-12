import {
  updateExternalCustomers,
  createCustomers,
  deleteExternalCustomers,
  updateCustomers,
  listCustomers,
} from '@polar-sh/sdk/2026-04/services/customers'
import type { AuthContext, GenericEndpointContext, User } from 'better-auth'
import { APIError } from 'better-auth/api'
import {
  assertUserDeletionSoleCreatorInvariant,
  synchronizeUserDeletionMemberships,
  synchronizeUserOrganizationProfiles,
} from '../organization/lifecycle'
import type { PolarOptions } from '../types'

const isAnonymousUser = (user: Partial<User>) =>
  'isAnonymous' in user && user.isAnonymous === true

export const onAfterUserCreate =
  (options: PolarOptions) =>
  async (user: User, context: GenericEndpointContext | null) => {
    if (!context || !options.createCustomerOnSignUp || isAnonymousUser(user)) {
      return
    }

    try {
      const existingCustomers = await listCustomers(options.client)({
        email: user.email,
      })
      const existingCustomer = existingCustomers.items.find(
        (c) => c.type === 'individual',
      )

      if (existingCustomer) {
        if (existingCustomer.external_id === user.id) {
          return
        }
        if (existingCustomer.external_id !== null) {
          throw new APIError('CONFLICT', {
            message: 'Polar customer is already linked to a different user',
          })
        }
        await updateCustomers(options.client)(existingCustomer.id, {
          external_id: user.id,
        })
        return
      }

      if (existingCustomers.items.some((c) => c.type === 'team')) {
        throw new APIError('CONFLICT', {
          message: 'A team customer with this email already exists',
        })
      }

      const params = options.getCustomerCreateParams
        ? await options.getCustomerCreateParams({ user })
        : {}

      await createCustomers(options.client)({
        ...params,
        email: user.email,
        name: user.name,
        external_id: user.id,
      })
    } catch (e: unknown) {
      if (e instanceof APIError) {
        throw e
      }
      throw new APIError('INTERNAL_SERVER_ERROR', {
        message: `Polar customer creation failed. Error: ${e instanceof Error ? e.message : e}`,
      })
    }
  }

export const onUserUpdate =
  (options: PolarOptions, initContext?: AuthContext) =>
  async (user: User, context: GenericEndpointContext | null) => {
    // Preserve the existing personal-customer behavior, including its
    // best-effort error handling, independently from organization support.
    if (context && options.createCustomerOnSignUp) {
      try {
        if (!isAnonymousUser(user)) {
          await updateExternalCustomers(options.client)(user.id, {
            email: user.email,
            name: user.name,
          })
        }
      } catch (e: unknown) {
        if (e instanceof Error) {
          context.context.logger.error(
            `Polar customer update failed. Error: ${e.message}`,
          )
        } else {
          context.context.logger.error(
            `Polar customer update failed. Error: ${e}`,
          )
        }
      }
    }

    if (!options.experimental_organizationSync?.enabled) {
      return
    }

    const authContext = context?.context ?? initContext

    if (!authContext) {
      throw new Error(
        'Polar organization profile synchronization requires a Better Auth context',
      )
    }

    await synchronizeUserOrganizationProfiles(
      authContext,
      options.client,
      user,
      options.experimental_organizationSync,
    )
  }

/**
 * Membership rows are still queryable here. Better Auth may cascade them
 * before the user `after` hook runs, so organization cleanup cannot move later.
 */
export const onBeforeUserDelete =
  (options: PolarOptions, initContext?: AuthContext) =>
  async (user: User, context: GenericEndpointContext | null) => {
    if (!options.experimental_organizationSync?.enabled) {
      return
    }
    const authContext = context?.context ?? initContext
    if (!authContext) {
      throw new Error(
        'Polar organization member deletion requires a Better Auth context',
      )
    }
    await synchronizeUserDeletionMemberships(
      authContext,
      options.client,
      user,
      options.experimental_organizationSync,
    )
  }

export const onUserDelete =
  (options: PolarOptions) =>
  async (user: User, context: GenericEndpointContext | null) => {
    if (context && options.createCustomerOnSignUp) {
      try {
        if (isAnonymousUser(user)) {
          return
        }

        await deleteExternalCustomers(options.client)(user.id)
      } catch (e: unknown) {
        if (e instanceof Error) {
          context?.context.logger.error(
            `Polar customer delete failed. Error: ${e.message}`,
          )
          return
        }
        context?.context.logger.error(
          `Polar customer delete failed. Error: ${e}`,
        )
      }
    }
  }

/**
 * Install a pre-destruction guard on the `user.deleteUser.beforeDelete` route
 * hook so the sole-creator invariant is rejected with a clean `APIError`
 * *before* Better Auth destroys credential `account` rows.
 *
 * Better Auth merges a plugin's `result.options` (other than `databaseHooks`)
 * via `defu(options, restOpts)`, which only fills missing keys and silently
 * discards a plugin-supplied `beforeDelete` whenever the host already declares
 * one. To survive that merge, this installs the guard by mutating the
 * context's `user.deleteUser` option directly at `init` time — the same
 * mutation pattern `installOrganizationHooks` uses for organization hooks —
 * and chains into any host-supplied `beforeDelete` so the adopter's existing
 * handler still runs first.
 */
export const installUserDeletePrecondition = (
  ctx: AuthContext,
  options: PolarOptions,
) => {
  const organizationOptions = options.experimental_organizationSync
  if (!organizationOptions?.enabled) {
    return
  }

  const deleteUserOptions = ctx.options.user?.deleteUser
  if (!deleteUserOptions) {
    return
  }

  const existingBeforeDelete = deleteUserOptions.beforeDelete
  deleteUserOptions.beforeDelete = async (user: User, request?: Request) => {
    if (existingBeforeDelete) {
      await existingBeforeDelete(user, request)
    }
    await assertUserDeletionSoleCreatorInvariant(ctx, options.client, user)
  }
}
