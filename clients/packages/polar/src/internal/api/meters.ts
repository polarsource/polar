import type { Polar } from '../../sdk'

export const getMeterId = async (
  sdk: Polar,
  externalId: string,
): Promise<string> => {
  let id: string | undefined
  for await (const meter of sdk.meters.iterList({ is_archived: false })) {
    if ('external_id' in meter && meter.external_id === externalId) {
      if (id !== undefined) {
        throw new Error(
          `Meter external ID ${JSON.stringify(externalId)} is ambiguous. Use an organization-scoped token.`,
        )
      }
      id = meter.id
    }
  }
  if (id === undefined) {
    throw new Error(
      `Meter ${JSON.stringify(externalId)} is not deployed in this environment.`,
    )
  }
  return id
}
