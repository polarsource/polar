import { errors, type Polar } from '../../sdk'

export const assertMeterDeployed = async (
  sdk: Polar,
  externalId: string,
): Promise<void> => {
  try {
    const meter = await sdk.meters.getExternal(externalId)
    if (meter.archived_at == null) return
  } catch (error) {
    if (error instanceof errors.AmbiguousExternalMeterID) {
      throw new Error(
        `Meter external ID ${JSON.stringify(externalId)} is ambiguous. Use an organization-scoped token.`,
      )
    }
    if (!(error instanceof errors.ResourceNotFound)) throw error
  }
  throw new Error(
    `Meter ${JSON.stringify(externalId)} is not deployed in this environment.`,
  )
}
