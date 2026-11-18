import { Effect } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import type { ConfigIssue, LoadedConfig } from '@/schemas/BillingConfig'
import { type Clients, eventNames } from '@/services/billing-config/api'
import { entryKey, record } from '@/utils/billing-config/describe'
import { referencedResource } from '@/utils/billing-config/problems'
import { NOUNS } from '@/utils/billing-config/review'
import { closest } from '@/utils/closest'

const externalIds = (input: unknown, resource: string | undefined) => {
  const section = NOUNS.find(([, noun]) => noun === resource)?.[0]
  const entries = section === undefined ? undefined : record(input)?.[section]
  return (Array.isArray(entries) ? entries : []).flatMap((entry) => {
    const key = entryKey(entry)
    return key === undefined ? [] : [key]
  })
}

const textOf = (got: string | undefined) => {
  try {
    const value: unknown = got === undefined ? undefined : JSON.parse(got)
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

export const withSuggestions = (
  clients: Clients,
  organization: ActiveOrganization,
  config: LoadedConfig,
  issues: ReadonlyArray<ConfigIssue>,
) =>
  Effect.gen(function* () {
    const events = issues.some(({ code }) => code === 'unknown_event')
      ? yield* eventNames(clients, organization)
      : []
    const candidates = (issue: ConfigIssue) =>
      issue.code === 'unknown_event'
        ? events
        : issue.code === 'unknown_reference'
          ? externalIds(config.input, referencedResource(issue.message))
          : []
    return issues.map((issue) => {
      const wanted = textOf(issue.got)
      const suggestion =
        wanted === undefined ? undefined : closest(wanted, candidates(issue))
      return suggestion === undefined ? issue : { ...issue, suggestion }
    })
  })
