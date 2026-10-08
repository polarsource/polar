export type CustomerIdentifier =
  | { customer_id: string }
  | { external_customer_id: string }

export type MemberIdentifier = CustomerIdentifier &
  (
    | { member_id: string; external_member_id?: never }
    | { external_member_id: string; member_id?: never }
    | { member_id?: never; external_member_id?: never }
  )

export const findIdByExternalId = async (
  kind: 'Meter' | 'Benefit',
  resources: AsyncIterable<{ readonly id: string }>,
  externalId: string,
): Promise<string> => {
  let id: string | undefined
  for await (const resource of resources) {
    if ('external_id' in resource && resource.external_id === externalId) {
      if (id !== undefined) {
        throw new Error(
          `${kind} external ID ${JSON.stringify(externalId)} is ambiguous. Use an organization-scoped token.`,
        )
      }
      id = resource.id
    }
  }
  if (id === undefined) {
    throw new Error(
      `${kind} ${JSON.stringify(externalId)} is not deployed in this environment.`,
    )
  }
  return id
}
