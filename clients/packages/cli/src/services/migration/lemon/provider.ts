import {
  getAuthenticatedUser,
  type ListStores,
  lemonSqueezySetup,
  listCustomers,
  listDiscounts,
  listFiles,
  listProducts,
  listStores,
  listVariants,
} from '@lemonsqueezy/lemonsqueezy.js'
import { Context, Data, Effect, Layer, Schema } from 'effect'
import { CustomerCreate } from '../../../schemas/Customer'
import { ProductCreate } from '../../../schemas/Product'
import { fetchAllPages, promiseAllInBatches } from '../../../utils'
import { parseCustomers, parseVariants } from './transform'

export class LemonSqueezyError extends Data.TaggedError('LemonSqueezyError')<{
  message: string
  cause?: unknown
}> {}

export interface LemonSqueezyImpl {
  stores: () => Effect.Effect<ListStores['data'], LemonSqueezyError, never>
  customers: (
    storeId: string,
  ) => Effect.Effect<readonly CustomerCreate[], LemonSqueezyError, never>
  products: (
    storeId: string,
  ) => Effect.Effect<readonly ProductCreate[], LemonSqueezyError, never>
}

export class LemonSqueezy extends Context.Service<
  LemonSqueezy,
  LemonSqueezyImpl
>()('LemonSqueezy') {}

export const make = (apiKey: string) =>
  Effect.gen(function* () {
    const client = yield* createLemonClient(apiKey)

    return LemonSqueezy.of({
      stores: () =>
        Effect.tryPromise({
          try: () =>
            fetchAllPages((pageNumber: number) =>
              client
                .listStores({
                  page: { number: pageNumber, size: 50 },
                })
                .then((response) => ({
                  data: response.data?.data,
                  lastPage: response.data?.meta.page.lastPage ?? 1,
                })),
            ),
          catch: (error) =>
            new LemonSqueezyError({
              message: 'Failed to list Lemon Squeezy stores',
              cause: error,
            }),
        }),
      customers: (storeId: string) =>
        Effect.tryPromise({
          try: async () => {
            const customers = await fetchAllPages((pageNumber: number) =>
              client
                .listCustomers({
                  filter: {
                    storeId,
                  },
                  page: {
                    number: pageNumber,
                    size: 50,
                  },
                })
                .then((response) => ({
                  data: response.data?.data,
                  lastPage: response.data?.meta.page.lastPage ?? 1,
                })),
            )

            return customers
          },
          catch: (error) =>
            new LemonSqueezyError({
              message: 'Failed to list Lemon Squeezy customers',
              cause: error,
            }),
        }).pipe(
          Effect.map(parseCustomers),
          Effect.flatMap(
            Schema.decodeUnknownEffect(Schema.Array(CustomerCreate)),
          ),
          Effect.catchTag('SchemaError', (error) =>
            Effect.fail(
              new LemonSqueezyError({
                message: 'Failed to parse customers',
                cause: error,
              }),
            ),
          ),
        ),
      products: (storeId: string) =>
        Effect.tryPromise({
          try: async () => {
            // Fetch all products for this store
            const products = await fetchAllPages((pageNumber: number) =>
              client
                .listProducts({
                  filter: { storeId },
                  page: { number: pageNumber, size: 50 },
                })
                .then((response) => ({
                  data: response.data?.data,
                  lastPage: response.data?.meta.page.lastPage ?? 1,
                })),
            )

            // Fetch variants for each product in batches to respect rate limits
            const variantGroups = await promiseAllInBatches(
              (product) =>
                fetchAllPages((pageNumber: number) =>
                  client
                    .listVariants({
                      filter: { productId: product.id },
                      page: { number: pageNumber, size: 50 },
                    })
                    .then((response) => ({
                      data: response.data?.data,
                      lastPage: response.data?.meta.page.lastPage ?? 1,
                    })),
                ),
              products,
              5,
            )

            return variantGroups.flat()
          },
          catch: (error) =>
            new LemonSqueezyError({
              message: 'Failed to list Lemon Squeezy products',
              cause: error,
            }),
        }).pipe(
          Effect.map(parseVariants),
          Effect.flatMap(
            Schema.decodeUnknownEffect(Schema.Array(ProductCreate)),
          ),
          Effect.catchTag('SchemaError', (error) =>
            Effect.fail(
              new LemonSqueezyError({
                message: 'Failed to parse products',
                cause: error,
              }),
            ),
          ),
        ),
    })
  })

export const layer = (apiKey: string) =>
  Layer.effect(LemonSqueezy, make(apiKey))

export const createLemonClient = (apiKey: string) =>
  Effect.try(() => {
    lemonSqueezySetup({
      apiKey,
      onError: (error) => {
        throw new LemonSqueezyError({
          message: 'Failed to setup Lemon Squeezy client',
          cause: error,
        })
      },
    })

    return {
      getAuthenticatedUser,
      listStores,
      listProducts,
      listDiscounts,
      listFiles,
      listVariants,
      listCustomers,
    }
  })
