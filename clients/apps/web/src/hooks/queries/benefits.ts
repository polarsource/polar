import { BenefitCreate, BenefitUpdate } from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import { defaultRetry } from './retry'

const _invalidateBenefitsQueries = ({
  id,
  orgId,
}: {
  id?: string
  orgId?: string
}) => {
  if (id) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'id', id],
    })
  }

  if (orgId) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'organization', orgId],
    })
  }

  queryClient.invalidateQueries({
    queryKey: ['subscriptionTiers'],
  })
}

export const useBenefits = (orgId?: string, limit = 30) =>
  useQuery({
    queryKey: ['benefits', 'organization', orgId],
    queryFn: () =>
      api.benefits.list({
        organizationId: orgId ?? '',
        limit,
      }),
    retry: defaultRetry,
    enabled: !!orgId,
  })

export const useBenefit = (id?: string) =>
  useQuery({
    queryKey: ['benefits', 'id', id],
    queryFn: () => {
      return api.benefits.get({
        id: id ?? '',
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUpdateBenefit = (orgId?: string) =>
  useMutation({
    mutationFn: ({ id, body }: { id: string; body: BenefitUpdate }) => {
      return api.benefits.update({
        id,
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      _invalidateBenefitsQueries({ id: result.id, orgId })
    },
  })

export const useCreateBenefit = (orgId?: string) =>
  useMutation({
    mutationFn: (body: BenefitCreate) => {
      return api.benefits.create({
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      _invalidateBenefitsQueries({ id: result.id, orgId })
    },
  })

export const useDeleteBenefit = (orgId?: string) =>
  useMutation({
    mutationFn: ({ id }: { id: string }) => {
      return api.benefits.delete({
        id,
      })
    },
    onSuccess: (_result, variables, _ctx) => {
      _invalidateBenefitsQueries({ id: variables.id, orgId })
    },
  })
