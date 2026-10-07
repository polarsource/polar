import type { Polar } from '../../sdk'

export const getMeterId = async (
  sdk: Polar,
  externalId: string,
): Promise<string> => (await sdk.meters.getExternal(externalId)).id
