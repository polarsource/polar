import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useCallback, useContext, useEffect, useState } from 'react'

export enum UpsellKey {
  COST_INSIGHTS = 'cost_insights',
}

export enum LocalStorageKey {
  DISABLED_UPSELLS = 'disabled_upsells',
  IOS_APP_BANNER_DISMISSED = 'ios_app_banner_dismissed',
}

interface DisabledUpsellsStorage {
  [organizationId: string]: UpsellKey[]
}

const getDisabledUpsells = (): DisabledUpsellsStorage => {
  if (typeof window === 'undefined') {
    return {}
  }

  const stored = localStorage.getItem(LocalStorageKey.DISABLED_UPSELLS)
  if (!stored) {
    return {}
  }

  try {
    return JSON.parse(stored) as DisabledUpsellsStorage
  } catch {
    return {}
  }
}

export const useUpsell = (upsellKey: UpsellKey) => {
  const { organization } = useContext(OrganizationContext)

  const [isUpsellDisabled, setIsUpsellDisabled] = useState(() => {
    const disabledUpsells = getDisabledUpsells()
    const orgDisabledUpsells = disabledUpsells[organization.id] || []
    return orgDisabledUpsells.includes(upsellKey)
  })

  useEffect(() => {
    const disabledUpsells = getDisabledUpsells()
    const orgDisabledUpsells = disabledUpsells[organization.id] || []
    setIsUpsellDisabled(orgDisabledUpsells.includes(upsellKey))
  }, [organization, upsellKey])

  const disableUpsell = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const disabledUpsells = getDisabledUpsells()
    const orgDisabledUpsells = disabledUpsells[organization.id] || []

    if (!orgDisabledUpsells.includes(upsellKey)) {
      disabledUpsells[organization.id] = [...orgDisabledUpsells, upsellKey]
      localStorage.setItem(
        LocalStorageKey.DISABLED_UPSELLS,
        JSON.stringify(disabledUpsells),
      )
      setIsUpsellDisabled(true)
    }
  }, [organization, upsellKey])

  const enableUpsell = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const disabledUpsells = getDisabledUpsells()
    const orgDisabledUpsells = disabledUpsells[organization.id] || []

    if (orgDisabledUpsells.includes(upsellKey)) {
      disabledUpsells[organization.id] = orgDisabledUpsells.filter(
        (key) => key !== upsellKey,
      )

      if (disabledUpsells[organization.id].length === 0) {
        delete disabledUpsells[organization.id]
      }

      localStorage.setItem(
        LocalStorageKey.DISABLED_UPSELLS,
        JSON.stringify(disabledUpsells),
      )
      setIsUpsellDisabled(false)
    }
  }, [organization, upsellKey])

  return {
    isUpsellDisabled,
    enableUpsell,
    disableUpsell,
  }
}
