import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useUpdateUserOrganizationNotificationSettings = (
  organizationId: string,
) =>
  useMutation({
    mutationFn: (body: {
      notification_settings: schemas['OrganizationNotificationSettings']
    }) => {
      return api.PATCH(
        '/v1/users/me/organizations/{organization_id}/notification-settings',
        {
          params: { path: { organization_id: organizationId } },
          body,
        },
      )
    },
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({ queryKey: ['user'] })
      getQueryClient().invalidateQueries({
        queryKey: ['organizations', organizationId],
      })
    },
  })

export const useUserOrganizationNotificationSettings = (
  organizationId: string,
) =>
  useQuery({
    queryKey: ['user', 'organizationNotificationSettings', organizationId],
    queryFn: () =>
      unwrap(
        api.GET(
          '/v1/users/me/organizations/{organization_id}/notification-settings',
          { params: { path: { organization_id: organizationId } } },
        ),
      ),
    retry: defaultRetry,
  })
