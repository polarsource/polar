import { api } from '@/utils/client'
import { schemas, unwrap } from '@spaire/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useDiscordGuild: (
  guildToken?: string,
) => UseQueryResult<schemas['DiscordGuild'], Error> = (guildToken?: string) =>
  useQuery({
    queryKey: ['discord', 'guild', guildToken],
    queryFn: () =>
      unwrap(
        api.GET('/v1/integrations/discord/guild/lookup', {
          params: {
            query: {
              guild_token: guildToken ?? '',
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!guildToken,
  })
