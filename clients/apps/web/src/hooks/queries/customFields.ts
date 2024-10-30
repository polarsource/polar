import { api, queryClient } from '@/utils/api'
import {
  CustomField,
  CustomFieldCreate,
  CustomFieldsApiListRequest,
  CustomFieldUpdate,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const invalidateCustomFieldsQueries = ({
  id,
  organizationId,
}: {
  id?: string
  organizationId?: string
}) => {
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
  parameters?: Omit<CustomFieldsApiListRequest, 'organization_id'>,
) =>
  useQuery({
    queryKey: ['custom_fields', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.customFields.list({
        organizationId,
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })

export const useCreateCustomField = (organizationId: string) =>
  useMutation({
    mutationFn: (body: CustomFieldCreate) => {
      return api.customFields.create({
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      invalidateCustomFieldsQueries({ organizationId, id: result.id })
    },
  })

export const useUpdateCustomField = (id: string) =>
  useMutation({
    mutationFn: (body: CustomFieldUpdate) => {
      return api.customFields.update({
        id,
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      invalidateCustomFieldsQueries({
        id,
        organizationId: result.organization_id,
      })
    },
  })

export const useDeleteCustomField = () =>
  useMutation({
    mutationFn: (customField: CustomField) => {
      return api.customFields.delete({
        id: customField.id,
      })
    },
    onSuccess: (_result, variables, _ctx) => {
      invalidateCustomFieldsQueries({
        organizationId: variables.organization_id,
      })
    },
  })
