import {
  updateExternalCustomers,
  createCustomers,
  deleteCustomers,
  updateCustomers,
  listCustomers,
} from '@polar-sh/sdk/2026-04/services/customers'
import type { AuthContext, GenericEndpointContext, User } from 'better-auth'
import { APIError } from 'better-auth/api'
import {
  synchronizeUserDeletionMemberships,
  synchronizeUserOrganizationProfiles,
} from '../organization/lifecycle'
import type { PolarOptions } from '../types'

const isAnonymousUser = (user: Partial<User>) =>
  'isAnonymous' in user && user.isAnonymous === true

export const onBeforeUserCreate =
  (options: PolarOptions) =>
  async (user: Partial<User>, context: GenericEndpointContext | null) => {
    if (context && options.createCustomerOnSignUp) {
      try {
        if (isAnonymousUser(user)) {
          return
        }

        const params = options.getCustomerCreateParams
          ? await options.getCustomerCreateParams({
              user,
            })
          : {}

        if (!user.email) {
          throw new APIError('BAD_REQUEST', {
            message: 'An associated email is required',
          })
        }

        // Check if customer already exists
        const existingCustomers = await listCustomers(options.client)({
          email: user.email,
        })
        const existingCustomer = existingCustomers.items[0]

        // Skip creation if customer already exists
        if (!existingCustomer) {
          await createCustomers(options.client)({
            ...params,
            email: user.email,
            name: user.name,
          })
        }
      } catch (e: unknown) {
        if (e instanceof Error) {
          throw new APIError('INTERNAL_SERVER_ERROR', {
            message: `Polar customer creation failed. Error: ${e.message}`,
          })
        }

        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: `Polar customer creation failed. Error: ${e}`,
        })
      }
    }
  }

export const onAfterUserCreate =
  (options: PolarOptions) =>
  async (user: User, context: GenericEndpointContext | null) => {
    if (context && options.createCustomerOnSignUp) {
      if (isAnonymousUser(user)) {
        return
      }

      try {
        const existingCustomers = await listCustomers(options.client)({
          email: user.email,
        })
        const existingCustomer = existingCustomers.items[0]

        if (existingCustomer) {
          if (existingCustomer.external_id !== user.id) {
            await updateCustomers(options.client)(existingCustomer.id, {
              external_id: user.id,
            })
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error) {
          throw new APIError('INTERNAL_SERVER_ERROR', {
            message: `Polar customer creation failed. Error: ${e.message}`,
          })
        }

        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: `Polar customer creation failed. Error: ${e}`,
        })
      }
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

        if (user.email) {
          const existingCustomers = await listCustomers(options.client)({
            email: user.email,
          })
          const existingCustomer = existingCustomers.items[0]
          if (existingCustomer) {
            await deleteCustomers(options.client)(existingCustomer.id)
          }
        }
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
