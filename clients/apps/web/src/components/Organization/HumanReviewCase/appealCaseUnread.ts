import {
  useOrganizationReviewStatus,
  useSupportCase,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { useSyncExternalStore } from 'react'

export const isNotifiable = (m: schemas['SupportCaseMessage']) =>
  m.author_kind !== 'merchant' && m.type !== 'opened' && m.type !== 'closed'

const storageKey = (organizationId: string) =>
  `polar:appeal-case-seen:${organizationId}`

const SEEN_EVENT = 'polar:appeal-case-seen'

export const getSeenCount = (organizationId: string): number => {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(storageKey(organizationId))
  const parsed = raw === null ? 0 : parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export const markSeen = (organizationId: string, count: number) => {
  if (typeof window === 'undefined') return
  if (count <= getSeenCount(organizationId)) return
  window.localStorage.setItem(storageKey(organizationId), String(count))
  window.dispatchEvent(new Event(SEEN_EVENT))
}

const subscribe = (callback: () => void) => {
  window.addEventListener(SEEN_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(SEEN_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export const useAppealCaseUnreadCount = (
  organization: schemas['Organization'],
): number => {
  // For polling for the navigation badge we can do it a bit less often
  const pollInterval = 60_000
  const enabled = organization.status === 'denied'
  const { data: reviewStatus } = useOrganizationReviewStatus(
    organization.id,
    enabled,
    pollInterval,
  )
  const caseId = reviewStatus?.appeal_case_id ?? undefined
  const { data: thread } = useSupportCase(caseId, enabled, pollInterval)
  const seen = useSyncExternalStore(
    subscribe,
    () => getSeenCount(organization.id),
    () => 0,
  )
  const notifiable = (thread?.messages ?? []).filter(isNotifiable).length
  return Math.max(0, notifiable - seen)
}
