import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useDiscordGuild: (
  organizationId: string,
  guildId?: string,
) => UseQueryResult<schemas['DiscordGuild'], Error> = (
  organizationId: string,
  guildId?: string,
) =>
  useQuery({
    queryKey: ['discord', 'guild', organizationId, guildId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/integrations/discord/guild/lookup', {
          params: {
            query: {
              organization_id: organizationId,
              guild_id: guildId ?? '',
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!guildId,
  })
