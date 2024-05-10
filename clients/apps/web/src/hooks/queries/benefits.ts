import { BenefitCreate, BenefitUpdate, Platforms } from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import { defaultRetry } from './retry'

const _invalidateBenefitsQueries = ({
  id,
  orgName,
}: {
  id?: string
  orgName?: string
}) => {
  if (id) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'id', id],
    })
  }

  if (orgName) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'organization', orgName],
    })
  }

  queryClient.invalidateQueries({
    queryKey: ['subscriptionTiers'],
  })
}

export const useBenefits = (
  orgName?: string,
  limit = 30,
  platform: Platforms = Platforms.GITHUB,
) =>
  useQuery({
    queryKey: ['benefits', 'organization', orgName],
    queryFn: () =>
      api.benefits.listBenefits({
        organizationName: orgName ?? '',
        platform,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!orgName,
  })

export const useBenefit = (id?: string) =>
  useQuery({
    queryKey: ['benefits', 'id', id],
    queryFn: () => {
      return api.benefits.getBenefit({
        id: id ?? '',
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUpdateBenefit = (orgName?: string) =>
  useMutation({
    mutationFn: ({
      id,
      benefitUpdate,
    }: {
      id: string
      benefitUpdate: BenefitUpdate
    }) => {
      return api.benefits.updateBenefit({
        id,
        benefitUpdate,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      _invalidateBenefitsQueries({ id: result.id, orgName })
    },
  })

export const useCreateBenefit = (orgName?: string) =>
  useMutation({
    mutationFn: (benefitCreate: BenefitCreate) => {
      return api.benefits.createBenefit({
        benefitCreate,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      _invalidateBenefitsQueries({ id: result.id, orgName })
    },
  })

export const useDeleteBenefit = (orgName?: string) =>
  useMutation({
    mutationFn: ({ id }: { id: string }) => {
      return api.benefits.deleteBenefit({
        id,
      })
    },
    onSuccess: (_result, variables, _ctx) => {
      _invalidateBenefitsQueries({ id: variables.id, orgName })
    },
  })
