import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { getQueryClient } from '@/utils/api/query'
import { getServerURL } from '@/utils/api'
import { defaultRetry } from './retry'

const queryClient = getQueryClient()

// Types for perks (until OpenAPI types are regenerated)
export interface Perk {
  id: string
  provider_name: string
  logo_key: string
  headline: string
  description: string
  category: string
  redemption_type: string
  redemption_url: string | null
  featured: boolean
  created_at: string
  modified_at: string | null
}

export interface PerkWithCode extends Perk {
  redemption_code: string | null
}

export interface PerkClaimResponse {
  claimed: boolean
  perk: PerkWithCode
  total_claims: number
}

export interface PerksListResponse {
  items: Perk[]
  pagination: {
    total_count: number
    max_page: number
  }
}

// Temporary API helper until OpenAPI types are regenerated
const perksApi = {
  async list(params?: {
    category?: string
    featured?: boolean
    page?: number
    limit?: number
  }): Promise<PerksListResponse> {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.featured !== undefined)
      searchParams.set('featured', String(params.featured))
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))

    const url = `${getServerURL()}/v1/perks/${searchParams.toString() ? `?${searchParams}` : ''}`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch perks')
    return res.json()
  },

  async get(perkId: string): Promise<Perk> {
    const res = await fetch(`${getServerURL()}/v1/perks/${perkId}`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to fetch perk')
    return res.json()
  },

  async claim(perkId: string): Promise<PerkClaimResponse> {
    const res = await fetch(`${getServerURL()}/v1/perks/${perkId}/claim`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to claim perk')
    return res.json()
  },
}

export const usePerks = (parameters?: {
  category?: string
  featured?: boolean
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: ['perks', parameters],
    queryFn: () => perksApi.list(parameters),
    retry: defaultRetry,
    placeholderData: keepPreviousData,
  })

export const usePerk = (perkId?: string) =>
  useQuery({
    queryKey: ['perks', 'id', perkId],
    queryFn: () => perksApi.get(perkId!),
    retry: defaultRetry,
    enabled: !!perkId,
  })

export const useClaimPerk = () =>
  useMutation({
    mutationFn: (perkId: string) => perksApi.claim(perkId),
    onSuccess: (_result, perkId) => {
      queryClient.invalidateQueries({
        queryKey: ['perks'],
      })
      queryClient.invalidateQueries({
        queryKey: ['perks', 'id', perkId],
      })
    },
  })
