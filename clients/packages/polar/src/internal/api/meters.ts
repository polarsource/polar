import type { Polar } from '../../sdk'
import { findIdByExternalId } from './utils'

export const getMeterId = (sdk: Polar, externalId: string): Promise<string> =>
  findIdByExternalId(
    'Meter',
    sdk.meters.iterList({ is_archived: false }),
    externalId,
  )
