'use client'

import { useState } from 'react'
import {
  PrototypeAction,
  RESOLUTION_DOMAINS,
  ResolutionChoices,
  ResolutionDomain,
} from './model'

function domainFromAction(action: PrototypeAction): ResolutionDomain | null {
  if (typeof action === 'string') {
    return null
  }
  if (action.type === 'choose_product') {
    return 'product'
  }
  if (action.type === 'choose_country') {
    return 'country'
  }
  if (action.type === 'choose_identity') {
    return 'identity'
  }
  return null
}

function firstUnresolvedDomain(
  resolutions: ResolutionChoices,
): ResolutionDomain | undefined {
  return RESOLUTION_DOMAINS.find((domain) => resolutions[domain] === null)
}

export function useResolutionDomainFocus(
  resolutions: ResolutionChoices,
  autoAdvance: boolean,
) {
  const [focusedDomain, setFocusedDomain] = useState<ResolutionDomain | null>(
    null,
  )
  const firstUnresolved = firstUnresolvedDomain(resolutions)
  const activeDomain =
    focusedDomain ??
    firstUnresolved ??
    RESOLUTION_DOMAINS[RESOLUTION_DOMAINS.length - 1]

  const selectDomain = (domain: ResolutionDomain) => {
    setFocusedDomain(domain)
  }

  const wrapAct =
    (act: (action: PrototypeAction) => void) => (action: PrototypeAction) => {
      const domain = domainFromAction(action)
      act(action)
      if (!domain) {
        return
      }
      if (!autoAdvance || resolutions[domain] !== null) {
        setFocusedDomain(domain)
        return
      }
      const nextUnresolved = RESOLUTION_DOMAINS.find(
        (candidate) => candidate !== domain && resolutions[candidate] === null,
      )
      setFocusedDomain(nextUnresolved ?? domain)
    }

  return { activeDomain, selectDomain, wrapAct }
}
