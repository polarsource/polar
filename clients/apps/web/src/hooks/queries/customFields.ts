import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const invalidateCustomFieldsQueries = ({
  id,
  organizationId,
}: {
  id?: string
  organizationId?: string
}) => {
  const queryClient = getQueryClient()
  if (id) {
    queryClient.invalidateQueries({
      queryKey: ['custom_fields', 'id', id],
    })
  }

  if (organizationId) {
    queryClient.invalidateQueries({
      queryKey: ['custom_fields', { organizationId }],
    })
  }
}

export const useCustomFields = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['custom-fields:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['custom_fields', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/custom-fields/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
            },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreateCustomField = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['CustomFieldCreate']) => {
      return api.POST('/v1/custom-fields/', { body })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      invalidateCustomFieldsQueries({ organizationId, id: data.id })
    },
  })

export const useUpdateCustomField = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['CustomFieldUpdate']) => {
      return api.PATCH('/v1/custom-fields/{id}', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      invalidateCustomFieldsQueries({
        id,
        organizationId: data.organization_id,
      })
    },
  })

export const useDeleteCustomField = () =>
  useMutation({
    mutationFn: (customField: schemas['CustomField']) => {
      return api.DELETE('/v1/custom-fields/{id}', {
        params: { path: { id: customField.id } },
      })
    },
    onSuccess: (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      invalidateCustomFieldsQueries({
        organizationId: variables.organization_id,
      })
    },
  })
