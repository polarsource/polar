// Generated from discounts:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  data,
  mergeInput,
  missingFlags,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['discounts']['create']>[0]>

export const command = Command.make(
  'create',
  {
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      name: Flag.String('name').pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. Name of the discount. Will be displayed to the customer when the discount is applied.',
        ),
      ),
      code: nullableStringFlag('code').pipe(
        Flag.optional,
        Flag.withDescription(
          'Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API.',
        ),
      ),
      starts_at: nullableStringFlag('starts-at').pipe(
        Flag.optional,
        Flag.withDescription(
          'Optional timestamp after which the discount is redeemable.',
        ),
      ),
      ends_at: nullableStringFlag('ends-at').pipe(
        Flag.optional,
        Flag.withDescription(
          'Optional timestamp after which the discount is no longer redeemable.',
        ),
      ),
      max_redemptions: Flag.Int('max-redemptions').pipe(
        Flag.optional,
        Flag.withDescription(
          'Optional maximum number of times the discount can be redeemed.',
        ),
      ),
      max_redemptions_per_customer: Flag.Int(
        'max-redemptions-per-customer',
      ).pipe(
        Flag.optional,
        Flag.withDescription(
          'Optional maximum number of times the discount can be redeemed by a single customer.',
        ),
      ),
      products: Flag.String('products')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('products')),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the discount. Defaults to the active organization.',
        ),
      ),
      type: Flag.Literals('type', ['fixed', 'percentage']).pipe(
        Flag.optional,
        Flag.withDescription('type'),
      ),
      duration: Flag.Literals('duration', [
        'once',
        'forever',
        'repeating',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. For subscriptions, determines if the discount should be applied once on the first invoice, forever, or for a certain number of months determined by `duration_in_months`.',
        ),
      ),
      duration_in_months: Flag.Int('duration-in-months').pipe(
        Flag.optional,
        Flag.withDescription(
          'Number of months the discount should be applied.',
        ),
      ),
      amount: Flag.Int('amount').pipe(
        Flag.optional,
        Flag.withDescription('amount'),
      ),
      currency: Flag.Literals('currency', [
        'aed',
        'all',
        'amd',
        'aoa',
        'ars',
        'aud',
        'awg',
        'azn',
        'bam',
        'bbd',
        'bdt',
        'bif',
        'bmd',
        'bnd',
        'bob',
        'brl',
        'bsd',
        'bwp',
        'bzd',
        'cad',
        'cdf',
        'chf',
        'clp',
        'cny',
        'cop',
        'crc',
        'cve',
        'czk',
        'djf',
        'dkk',
        'dop',
        'dzd',
        'egp',
        'etb',
        'eur',
        'fjd',
        'fkp',
        'gbp',
        'gel',
        'gip',
        'gmd',
        'gnf',
        'gtq',
        'gyd',
        'hkd',
        'hnl',
        'htg',
        'huf',
        'idr',
        'ils',
        'inr',
        'isk',
        'jmd',
        'jpy',
        'kes',
        'kgs',
        'khr',
        'kmf',
        'krw',
        'kyd',
        'kzt',
        'lak',
        'lkr',
        'lrd',
        'lsl',
        'mad',
        'mdl',
        'mga',
        'mkd',
        'mnt',
        'mop',
        'mur',
        'mvr',
        'mwk',
        'mxn',
        'myr',
        'mzn',
        'nad',
        'ngn',
        'nio',
        'nok',
        'npr',
        'nzd',
        'pab',
        'pen',
        'pgk',
        'php',
        'pkr',
        'pln',
        'pyg',
        'qar',
        'ron',
        'rsd',
        'rwf',
        'sar',
        'sbd',
        'scr',
        'sek',
        'sgd',
        'shp',
        'sos',
        'srd',
        'szl',
        'thb',
        'tjs',
        'top',
        'try',
        'ttd',
        'twd',
        'tzs',
        'uah',
        'ugx',
        'usd',
        'uyu',
        'uzs',
        'vnd',
        'vuv',
        'wst',
        'xaf',
        'xcd',
        'xcg',
        'xof',
        'xpf',
        'yer',
        'zar',
        'zmw',
      ]).pipe(Flag.optional, Flag.withDescription('currency')),
      amounts: jsonFlag('amounts').pipe(
        Flag.optional,
        Flag.withDescription('amounts JSON: {"<key>": integer}'),
      ),
      basis_points: Flag.Int('basis-points').pipe(
        Flag.optional,
        Flag.withDescription('Discount percentage in basis points.'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const { organization_id: organizationId, ...body } = mergeInput<Body>(
        config.data,
        {
          metadata: config.input.metadata,
          name: config.input.name,
          code: config.input.code,
          starts_at: config.input.starts_at,
          ends_at: config.input.ends_at,
          max_redemptions: config.input.max_redemptions,
          max_redemptions_per_customer:
            config.input.max_redemptions_per_customer,
          products: config.input.products,
          organization_id: config.input.organization_id,
          type: config.input.type,
          duration: config.input.duration,
          duration_in_months: config.input.duration_in_months,
          amount: config.input.amount,
          currency: config.input.currency,
          amounts: config.input.amounts,
          basis_points: config.input.basis_points,
        },
      )
      const missing = missingFlags(body, ['name', 'duration'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar discounts create --name <name> --duration once',
        })
      }
      yield* api.execute({
        operationId: 'discounts:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId,
        invoke: (client) => client.discounts.create(body),
      })
    }),
).pipe(Command.withDescription('Create a discount.'))
